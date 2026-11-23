"""Business rules for projects: drafts, autosave, uploads, repo preview, publishing.

Rule for the database: every function here that changes data is one unit of work and commits
it itself. Routers never commit; they only call these functions.
"""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from slugify import slugify
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog import UPLOAD_RULES
from app.errors import AppError
from app.github import GitHub, GitHubUnavailable, parse_repo_url
from app.projects.models import Project
from app.projects.schemas import ProjectOut, UploadComplete, UploadRequest, UploadTicket, VideoOut
from app.storage import Storage

logger = logging.getLogger(__name__)

REQUIRED_TEXT = [
    "name",
    "short_description",
    "project_type",
    "category",
    "problem",
    "outcome",
    "audience",
    "getting_started",
    "requirements",
    "license",
    "status",
]
REQUIRED_LISTS = ["post_languages", "languages", "tools", "deliverables"]
UPLOAD_FOLDERS = {"video": "videos", "poster": "posters"}
FILE_EXTENSIONS = {"video/mp4": "mp4", "video/webm": "webm", "image/jpeg": "jpg"}
# Apostrophes inside words (O'zbek) are dropped instead of becoming a hyphen.
SLUG_REPLACEMENTS = [[mark, ""] for mark in ("'", "’", "ʻ", "ʼ", "`")]


def missing_fields(project: Project) -> list[str]:
    """Required fields that are still empty. Publishing is allowed only when this is empty."""
    missing = [f for f in REQUIRED_TEXT if not getattr(project, f)]
    missing += [f for f in REQUIRED_LISTS if not getattr(project, f)]
    if project.video_key is None:
        missing.append("video")
    if project.repo_snapshot is None:
        missing.append("repo")
    return missing


def to_out(project: Project, storage: Storage) -> ProjectOut:
    """The project as the API returns it, with fresh signed links to its files."""
    video = None
    if project.video_key:
        video = VideoOut(
            url=storage.presign_get(project.video_key),
            poster_url=storage.presign_get(project.poster_key) if project.poster_key else None,
            file_name=project.video_file_name,
            content_type=project.video_content_type,
            size=project.video_size,
            duration_seconds=project.video_duration_seconds,
        )
    computed = {"video", "repo", "missing_fields"}
    columns = {f: getattr(project, f) for f in ProjectOut.model_fields if f not in computed}
    return ProjectOut(
        **columns, video=video, repo=project.repo_snapshot, missing_fields=missing_fields(project)
    )


async def create_draft(session: AsyncSession) -> Project:
    project = Project()
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project


async def get_project(session: AsyncSession, project_id: uuid.UUID) -> Project:
    project = await session.get(Project, project_id)
    if project is None:
        raise AppError(404, "project_not_found", "Project not found")
    return project


async def get_draft(session: AsyncSession, project_id: uuid.UUID) -> Project:
    project = await get_project(session, project_id)
    if project.published_at is not None:
        raise AppError(409, "project_published", "A published project cannot be changed")
    return project


async def update_draft(
    session: AsyncSession, project_id: uuid.UUID, changes: dict[str, Any]
) -> Project:
    project = await get_draft(session, project_id)
    for field, value in changes.items():
        setattr(project, field, value)
    _check_dates(project)  # after merging: a partial change cannot see the other date
    await session.commit()
    await session.refresh(project)
    return project


def _check_dates(project: Project) -> None:
    if project.ongoing and project.finished_on is not None:
        raise AppError(422, "invalid_dates", "An ongoing project has no finish date")
    if project.started_on and project.finished_on and project.finished_on < project.started_on:
        raise AppError(422, "invalid_dates", "The finish date is before the start date")


async def create_upload(
    session: AsyncSession,
    storage: Storage,
    project_id: uuid.UUID,
    kind: str,
    request: UploadRequest,
) -> UploadTicket:
    """Checks the file and signs a one-time upload link; the browser then uploads to R2 itself."""
    await get_draft(session, project_id)
    rules = UPLOAD_RULES[kind]
    if request.content_type not in rules["content_types"]:
        allowed = ", ".join(rules["content_types"])
        raise AppError(422, "upload_type_not_allowed", f"Allowed types: {allowed}")
    if request.size > rules["max_bytes"]:
        limit_mb = rules["max_bytes"] // (1024 * 1024)
        raise AppError(422, "upload_too_large", f"The file must be at most {limit_mb} MB")

    extension = FILE_EXTENSIONS[request.content_type]
    key = f"{UPLOAD_FOLDERS[kind]}/{project_id}/{uuid.uuid4().hex}.{extension}"
    return UploadTicket(
        upload_url=storage.presign_put(key, request.content_type, request.size),
        key=key,
        headers={"Content-Type": request.content_type},
    )


async def complete_upload(
    session: AsyncSession, storage: Storage, project_id: uuid.UUID, kind: str, done: UploadComplete
) -> Project:
    """Checks that the uploaded file really is in R2 and valid, then attaches it to the project."""
    project = await get_draft(session, project_id)
    if not done.key.startswith(f"{UPLOAD_FOLDERS[kind]}/{project_id}/"):
        raise AppError(422, "upload_key_invalid", "This file does not belong to this project")

    stored = await storage.head(done.key)
    if stored is None:
        raise AppError(422, "upload_missing", "The file was not uploaded")
    rules = UPLOAD_RULES[kind]
    if stored.content_type not in rules["content_types"] or stored.size > rules["max_bytes"]:
        await storage.delete(done.key)
        raise AppError(422, "upload_invalid", "The uploaded file is not allowed")

    replaced: list[str] = []
    if kind == "video":
        replaced = [k for k in (project.video_key, project.poster_key) if k and k != done.key]
        project.video_key = done.key
        project.video_file_name = done.file_name
        project.video_content_type = stored.content_type
        project.video_size = stored.size
        project.video_duration_seconds = done.duration_seconds
        project.poster_key = None  # the old first frame belongs to the old video
    else:
        if project.video_key is None:
            raise AppError(422, "video_missing", "Upload the video before its first frame")
        replaced = [project.poster_key] if project.poster_key else []
        project.poster_key = done.key

    await session.commit()
    # Old files are deleted only after the new ones are saved, so a failure never loses both.
    # The upload already succeeded, so a failed clean-up must not turn it into an error.
    for key in replaced:
        try:
            await storage.delete(key)
        except Exception:
            logger.exception("Could not delete replaced file %s; it is left in the bucket", key)
    await session.refresh(project)
    return project


async def link_repo(
    session: AsyncSession, github: GitHub, project_id: uuid.UUID, url: str
) -> Project:
    project = await get_draft(session, project_id)
    parsed = parse_repo_url(url)
    if parsed is None:
        raise AppError(422, "repo_url_invalid", "Use a link like https://github.com/owner/repo")
    try:
        snapshot = await github.fetch_snapshot(*parsed)
    except GitHubUnavailable as exc:
        raise AppError(502, "github_unavailable", "GitHub did not answer, try again") from exc
    if snapshot is None:
        raise AppError(422, "repo_not_found", "Repository not found or not public")

    project.repo_url = snapshot.html_url
    project.repo_snapshot = snapshot.model_dump(mode="json")
    await session.commit()
    await session.refresh(project)
    return project


async def publish(session: AsyncSession, project_id: uuid.UUID) -> Project:
    """Publishes a complete draft under a unique address (slug) made from its name."""
    project = await get_draft(session, project_id)
    missing = missing_fields(project)
    if missing:
        raise AppError(422, "project_incomplete", f"Missing: {', '.join(missing)}")

    base = slugify(project.name, replacements=SLUG_REPLACEMENTS, max_length=60) or "project"
    for attempt in range(1, 100):
        project.slug = base if attempt == 1 else f"{base}-{attempt}"
        project.published_at = datetime.now(UTC)
        try:
            await session.commit()
        except IntegrityError:
            # The unique constraint on slug is the guard, so two publishes at the same
            # moment cannot get the same address. Take the next number and try again.
            await session.rollback()
            project = await get_draft(session, project_id)
            continue
        await session.refresh(project)
        return project
    raise AppError(409, "slug_unavailable", "Could not find a free address for this name")
