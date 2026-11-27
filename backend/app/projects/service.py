"""Business rules for projects: temporary uploads, repo preview, creating a project on Render,
and reading published projects.

Nothing is stored before Render (Bek, 2026-11-24): the form lives in the browser, files wait in
R2's temporary folder `uploads/` (emptied by a bucket lifecycle rule after a day), and
create_project writes the one row. A function here that changes data commits it itself; routers
never commit.
"""

import logging
import re
import uuid
from datetime import UTC, datetime

from slugify import slugify
from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.catalog import REQUIRED_LISTS, REQUIRED_TEXT, UPLOAD_RULES
from app.errors import AppError
from app.github import GitHub, GitHubUnavailable, RepoSnapshot, parse_repo_url
from app.projects.models import Project
from app.projects.schemas import (
    Feed,
    Owner,
    ProjectCard,
    ProjectCreate,
    ProjectOut,
    UploadRequest,
    UploadTicket,
    VideoOut,
)
from app.storage import Storage, StoredFile

logger = logging.getLogger(__name__)

FILE_EXTENSIONS = {"video/mp4": "mp4", "video/webm": "webm", "image/jpeg": "jpg"}
FINAL_FOLDERS = {"video": "videos", "poster": "posters"}
# Only keys this API handed out may be used, so a request cannot copy any other stored file.
TEMP_KEYS = {
    "video": re.compile(r"^uploads/[0-9a-f]{32}/video\.(mp4|webm)$"),
    "poster": re.compile(r"^uploads/[0-9a-f]{32}/poster\.jpg$"),
}
# Apostrophes inside words (O'zbek) are dropped instead of becoming a hyphen.
SLUG_REPLACEMENTS = [[mark, ""] for mark in ("'", "’", "ʻ", "ʼ", "`")]


def video_out(project: Project, storage: Storage) -> VideoOut | None:
    """The video's details with fresh signed links (valid one hour), or None without a video."""
    if not project.video_key:
        return None
    return VideoOut(
        url=storage.presign_get(project.video_key),
        poster_url=storage.presign_get(project.poster_key) if project.poster_key else None,
        file_name=project.video_file_name,
        content_type=project.video_content_type,
        size=project.video_size,
        duration_seconds=project.video_duration_seconds,
    )


def with_owner() -> Select[tuple[Project]]:
    """Every read of projects goes through here, so the owner is always loaded with them (the
    relationship refuses to load on its own: models.py)."""
    return select(Project).options(selectinload(Project.owner))


def to_out(project: Project, storage: Storage) -> ProjectOut:
    """The project as the API returns it, with fresh signed links to its files."""
    computed = {"video", "repo", "owner"}
    columns = {f: getattr(project, f) for f in ProjectOut.model_fields if f not in computed}
    return ProjectOut(
        **columns,
        video=video_out(project, storage),
        repo=project.repo_snapshot,
        owner=Owner.model_validate(project.owner),
    )


# --- before Render: nothing is stored ------------------------------------------------------


def create_upload(storage: Storage, kind: str, request: UploadRequest) -> UploadTicket:
    """Checks the file and signs a one-time link into the temporary folder."""
    rules = UPLOAD_RULES[kind]
    if request.content_type not in rules["content_types"]:
        allowed = ", ".join(rules["content_types"])
        raise AppError(422, "upload_type_not_allowed", f"Allowed types: {allowed}")
    if request.size > rules["max_bytes"]:
        limit_mb = rules["max_bytes"] // (1024 * 1024)
        raise AppError(422, "upload_too_large", f"The file must be at most {limit_mb} MB")

    extension = FILE_EXTENSIONS[request.content_type]
    key = f"uploads/{uuid.uuid4().hex}/{kind}.{extension}"
    return UploadTicket(
        upload_url=storage.presign_put(key, request.content_type, request.size),
        key=key,
        headers={"Content-Type": request.content_type},
    )


async def preview_repo(github: GitHub, url: str) -> RepoSnapshot:
    """What the repository looks like on GitHub right now (file list and README start)."""
    parsed = parse_repo_url(url)
    if parsed is None:
        raise AppError(422, "repo_url_invalid", "Use a link like https://github.com/owner/repo")
    try:
        snapshot = await github.fetch_snapshot(*parsed)
    except GitHubUnavailable as exc:
        raise AppError(502, "github_unavailable", "GitHub did not answer, try again") from exc
    if snapshot is None:
        raise AppError(422, "repo_not_found", "Repository not found or not public")
    return snapshot


# --- Render: the one write ------------------------------------------------------------------


def missing_fields(data: ProjectCreate) -> list[str]:
    """Required fields that are empty, in the catalog's order (REQUIRED_FIELDS)."""
    missing = [f for f in REQUIRED_TEXT if not getattr(data, f)]
    missing += [f for f in REQUIRED_LISTS if not getattr(data, f)]
    if data.video is None:
        missing.append("video")
    return missing


def _check_dates(data: ProjectCreate) -> None:
    if data.ongoing and data.finished_on is not None:
        raise AppError(422, "invalid_dates", "An ongoing project has no finish date")
    if data.started_on and data.finished_on and data.finished_on < data.started_on:
        raise AppError(422, "invalid_dates", "The finish date is before the start date")


async def _checked_upload(storage: Storage, kind: str, key: str) -> StoredFile | None:
    """The temporary file if it is one of ours, was really uploaded and follows the rules."""
    if not TEMP_KEYS[kind].match(key):
        return None
    stored = await storage.head(key)
    rules = UPLOAD_RULES[kind]
    if stored is None or stored.content_type not in rules["content_types"]:
        return None
    return stored if stored.size <= rules["max_bytes"] else None


async def _delete_quietly(storage: Storage, keys: list[str]) -> None:
    """Clean-up only: a failure is logged, never shown to the person."""
    for key in keys:
        try:
            await storage.delete(key)
        except Exception:
            logger.exception("Could not delete %s; it is left in the bucket", key)


async def create_project(
    session: AsyncSession,
    storage: Storage,
    github: GitHub,
    data: ProjectCreate,
    owner_id: uuid.UUID,
) -> Project:
    """Checks everything, moves the files out of the temporary folder, writes the row for its
    owner. `owner_id` is a plain value on purpose: a slug clash rolls the session back, which
    expires every object in it, the logged-in user included."""
    missing = missing_fields(data)
    if missing:
        raise AppError(422, "project_incomplete", f"Missing: {', '.join(missing)}")
    _check_dates(data)
    assert data.video is not None  # checked by missing_fields

    if not TEMP_KEYS["video"].match(data.video.key):
        raise AppError(422, "upload_key_invalid", "This video was not uploaded through this page")
    video = await _checked_upload(storage, "video", data.video.key)
    if video is None:
        raise AppError(
            422, "upload_missing", "The video is missing or not allowed, upload it again"
        )
    # The first frame is a nice-to-have: without a valid one the project is saved without it.
    poster_ok = data.poster_key and await _checked_upload(storage, "poster", data.poster_key)

    # The repository is optional (D25); a given link is read by the server, not the browser.
    snapshot = await preview_repo(github, data.repo_url) if data.repo_url else None

    project_id = uuid.uuid4()
    video_key = f"videos/{project_id}/{uuid.uuid4().hex}.{FILE_EXTENSIONS[video.content_type]}"
    poster_key = f"posters/{project_id}/{uuid.uuid4().hex}.jpg" if poster_ok else None
    copies: list[str] = []
    try:
        await storage.copy(data.video.key, video_key)
        copies.append(video_key)
        if poster_key:
            await storage.copy(data.poster_key, poster_key)
            copies.append(poster_key)
        fields = data.model_dump(exclude={"video", "poster_key", "repo_url"})
        files = {
            "video_key": video_key,
            "video_file_name": data.video.file_name,
            "video_content_type": video.content_type,
            "video_size": video.size,
            "video_duration_seconds": data.video.duration_seconds,
            "poster_key": poster_key,
            "repo_url": snapshot.html_url if snapshot else None,
            "repo_snapshot": snapshot.model_dump(mode="json") if snapshot else None,
            "owner_id": owner_id,
        }
        await _insert_with_free_slug(session, project_id, {**fields, **files})
    except Exception:
        await _delete_quietly(storage, copies)  # no row, so the copies belong to nothing
        raise

    # Only after the try: once the row is committed its files must never be deleted, even if
    # reading it back fails.
    temporary = [data.video.key] + ([data.poster_key] if data.poster_key else [])
    await _delete_quietly(storage, temporary)  # the lifecycle rule would remove them anyway
    # Read back fresh, with the owner and the server-set columns (created_at).
    query = with_owner().where(Project.id == project_id).execution_options(populate_existing=True)
    return (await session.scalars(query)).one()


async def _insert_with_free_slug(
    session: AsyncSession, project_id: uuid.UUID, values: dict
) -> Project:
    """Writes the row under a unique address (slug) made from the name: reflex, reflex-2, ..."""
    base = slugify(values["name"], replacements=SLUG_REPLACEMENTS, max_length=60) or "project"
    for attempt in range(1, 100):
        # A new object each time: a rolled-back object is no longer part of the session.
        project = Project(
            id=project_id,
            slug=base if attempt == 1 else f"{base}-{attempt}",
            published_at=datetime.now(UTC),
            **values,
        )
        session.add(project)
        try:
            await session.commit()
        except IntegrityError:
            # The unique constraint on slug is the guard, so two Renders at the same moment
            # cannot get the same address. Take the next number and try again.
            await session.rollback()
            continue
        return project
    raise AppError(409, "slug_unavailable", "Could not find a free address for this name")


# --- project page -------------------------------------------------------------------------------


async def get_published(session: AsyncSession, slug: str) -> Project:
    project = await session.scalar(with_owner().where(Project.slug == slug))
    if project is None:
        raise AppError(404, "project_not_found", "Project not found")
    return project


async def get_published_video(session: AsyncSession, storage: Storage, slug: str) -> VideoOut:
    video = video_out(await get_published(session, slug), storage)
    if video is None:
        raise AppError(404, "video_not_found", "This project has no video")
    return video


# --- feed -----------------------------------------------------------------------------------


def _like(text: str) -> str:
    """A LIKE pattern that matches the text anywhere; % and _ typed by the person stay literal."""
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


async def list_published(
    session: AsyncSession, storage: Storage, category: str | None, q: str | None, limit: int
) -> Feed:
    """The newest projects first, optionally of one category and matching a search in the name,
    the short description or the technologies (case does not matter)."""
    query = with_owner().order_by(Project.published_at.desc()).limit(limit)
    if category:
        query = query.where(Project.category == category)
    if q and q.strip():
        pattern = _like(q.strip())
        query = query.where(
            or_(
                Project.name.ilike(pattern, escape="\\"),
                Project.short_description.ilike(pattern, escape="\\"),
                func.array_to_string(Project.languages, " ").ilike(pattern, escape="\\"),
                func.array_to_string(Project.tools, " ").ilike(pattern, escape="\\"),
            )
        )
    projects = (await session.scalars(query)).all()
    computed = {"poster_url", "preview_url", "owner"}
    return Feed(
        items=[
            ProjectCard(
                **{f: getattr(p, f) for f in ProjectCard.model_fields if f not in computed},
                poster_url=storage.presign_get(p.poster_key) if p.poster_key else None,
                preview_url=storage.presign_get(p.preview_key) if p.preview_key else None,
                owner=Owner.model_validate(p.owner),
            )
            for p in projects
        ]
    )
