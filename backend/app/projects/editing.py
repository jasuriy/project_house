"""A developer's own projects: create, edit, delete (add-project design, part 1).

Every value is checked here in a fixed order and the first failure raises its own code, so the form
can show it next to the field. Nothing is written until everything passed; files of removed images
are deleted only after the commit.
"""

from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlsplit

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.errors import AppError
from app.media import storage
from app.media.service import consume_uploads
from app.projects.fields import FIELDS
from app.projects.github import (
    GitHubClient,
    GitHubUnavailable,
    check_ownership,
    github_account,
    parse_github_url,
    same_repository,
)
from app.projects.models import Project, ProjectMedia
from app.projects.schemas import ImageRef, ImportPreview, ProjectInput, ProjectUpdate
from app.projects.slugs import slugify
from app.projects.video import is_playable
from app.users.models import User

# name: (max length, required)
TEXT = {
    "title": (80, True),
    "one_line_problem": (160, True),
    "short_description": (1000, True),
    "result": (160, False),
    "role": (120, False),
}
MAX_TAGS, MAX_TAG = 12, 30
MAX_IMAGES = 6
MAX_LINK = 200
SLUG_INDEX = "uq_projects_owner_id_slug"


def _fail(code: str) -> AppError:
    return AppError(422, code, code.replace("_", " ").capitalize())


def _text(name: str, value: Any) -> str | None:
    limit, required = TEXT[name]
    value = value.strip() if isinstance(value, str) else ""
    if "\x00" in value or len(value) > limit or (required and not value):
        raise _fail(f"invalid_{name}")
    return value or None


def _tags(value: Any) -> list[str]:
    tags: list[str] = []
    for raw in value if isinstance(value, list) else []:
        tag = raw.strip() if isinstance(raw, str) else ""
        if not tag or len(tag) > MAX_TAG or "\x00" in tag:
            raise _fail("invalid_tech_stack")
        if tag.lower() not in (t.lower() for t in tags):
            tags.append(tag)
    if not 1 <= len(tags) <= MAX_TAGS:
        raise _fail("invalid_tech_stack")
    return tags


def _https_parts(value: str, schemes: tuple[str, ...]):
    if len(value) > MAX_LINK:
        return None
    try:
        parts = urlsplit(value)
        port = parts.port
    except ValueError:
        return None
    if parts.scheme not in schemes or not parts.hostname or parts.username or parts.password:
        return None
    return parts, port


def _github(value: Any) -> str | None:
    """Empty, or a GitHub repository link in its plain form https://github.com/<owner>/<repo>
    (what people paste is accepted: no scheme, www., .git, a deeper page of the repository)."""
    if not (value or "").strip():
        return None
    parsed = parse_github_url(value) if isinstance(value, str) else None
    if parsed is None:
        raise _fail("invalid_github_url")
    return "https://github.com/{}/{}".format(*parsed)


def _live(value: Any) -> str | None:
    value = (value or "").strip()
    if not value:
        return None
    if _https_parts(value, ("http", "https")):
        return value
    raise _fail("invalid_live_url")


def _video(value: Any) -> str | None:
    value = (value or "").strip()
    if not value:
        return None
    if len(value) <= MAX_LINK and is_playable(value):
        return value
    raise _fail("invalid_video_url")


def _columns(sent: dict[str, Any]) -> dict[str, Any]:
    """The project columns for the sent fields, checked in the form's order."""
    columns: dict[str, Any] = {}
    for name in ("title", "one_line_problem", "short_description", "result"):
        if name in sent:
            columns[name] = _text(name, sent[name])
    if "field" in sent:
        if sent["field"] not in FIELDS:
            raise _fail("invalid_field")
        columns["field"] = sent["field"]
    if "tech_stack" in sent:
        columns["tech_stack"] = _tags(sent["tech_stack"])
    if "github_url" in sent:
        columns["github_url"] = _github(sent["github_url"])
    if "live_url" in sent:
        columns["live_url"] = _live(sent["live_url"])
    if "role" in sent:
        columns["role"] = _text("role", sent["role"])
    if "video_url" in sent:
        columns["demo_video_url"] = _video(sent["video_url"])
    return columns


def _check_refs(refs: list[ImageRef], kept_allowed: set[int]) -> None:
    if len(refs) > MAX_IMAGES:
        raise _fail("invalid_images")
    for ref in refs:
        if (ref.upload is None) == (ref.media is None):
            raise _fail("invalid_images")
        if ref.media is not None and ref.media not in kept_allowed:
            raise _fail("invalid_images")
    kept = [r.media for r in refs if r.media is not None]
    if len(set(kept)) != len(kept):
        raise _fail("invalid_images")


async def _images(
    session: AsyncSession, user: User, refs: list[ImageRef], existing: dict[int, ProjectMedia]
) -> list[ProjectMedia]:
    """The image rows in the given order: kept rows as they are, uploads turned into new rows."""
    keys = iter(await consume_uploads(session, user.id, [r.upload for r in refs if r.upload]))
    return [
        existing[r.media]
        if r.media is not None
        else ProjectMedia(kind="image", storage_key=next(keys), position=0)
        for r in refs
    ]


def _place(video: str | None, images: list[ProjectMedia]) -> list[ProjectMedia]:
    """The video first, then the images; positions from 0."""
    media = ([ProjectMedia(kind="video", url=video, position=0)] if video else []) + images
    for position, item in enumerate(media):
        item.position = position
    return media


async def _unique_slug(session: AsyncSession, owner_id: int, title: str) -> str:
    base = slugify(title)[:60].strip("-") or "project"
    taken = set(
        await session.scalars(
            select(Project.slug).where(Project.owner_id == owner_id, Project.slug.like(f"{base}%"))
        )
    )
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"


async def own_project(session: AsyncSession, user: User, slug: str) -> Project:
    project = await session.scalar(
        select(Project)
        .options(selectinload(Project.media), joinedload(Project.owner))
        .where(Project.owner_id == user.id, Project.slug == slug)
        .execution_options(populate_existing=True)
    )
    if project is None:
        raise AppError(404, "project_not_found", "Project not found")
    return project


async def _verified_link(session: AsyncSession, user: User, github: GitHubClient, url: str) -> dict:
    """The ownership check for a new or changed GitHub link: the stored link and licence."""
    account = await github_account(session, user.id)
    # End the read before GitHub answers (may take seconds). commit, not rollback: a rollback
    # would expire the loaded user (expire_on_commit=False keeps it on commit).
    await session.commit()
    owned = await check_ownership(github, account, url)
    return {"github_url": owned.repo.html_url, "license": owned.repo.license_spdx}


async def create_project(
    session: AsyncSession, user: User, data: ProjectInput, github: GitHubClient
) -> Project:
    sent = data.model_dump(exclude_unset=True)
    refs = data.images or []
    columns = _columns({**sent, "result": sent.get("result"), "role": sent.get("role")})
    _check_refs(refs, kept_allowed=set())
    if not columns.get("demo_video_url") and not refs:
        raise _fail("media_required")
    if columns.get("github_url"):
        columns.update(await _verified_link(session, user, github, columns["github_url"]))

    media = _place(columns.get("demo_video_url"), await _images(session, user, refs, {}))
    slug = await _unique_slug(session, user.id, columns["title"])
    session.add(
        Project(
            owner_id=user.id,
            is_demo=False,
            slug=slug,
            published_at=datetime.now(UTC),
            media=media,
            **columns,
        )
    )
    try:
        await session.flush()
    except IntegrityError as error:
        # Two creates with the same title at the same moment: the second one asks to retry.
        if SLUG_INDEX in str(error.orig):
            raise AppError(409, "slug_taken", "Please try again") from None
        raise
    await session.commit()
    return await own_project(session, user, slug)


async def update_project(
    session: AsyncSession, user: User, slug: str, data: ProjectUpdate, github: GitHubClient
) -> Project:
    sent = data.model_dump(exclude_unset=True)
    sent.pop("images", None)
    columns = _columns(sent)
    if "github_url" in columns:
        stored = (
            await session.execute(
                select(Project.github_url, Project.is_demo).where(
                    Project.owner_id == user.id, Project.slug == slug
                )
            )
        ).first()
        if stored is None:
            raise AppError(404, "project_not_found", "Project not found")
        if stored.is_demo:
            raise AppError(403, "sample_read_only", "Sample projects can only be deleted")
        if not columns["github_url"]:
            columns["license"] = None
        elif same_repository(stored.github_url, columns["github_url"]):
            del columns["github_url"]  # unchanged: keep the stored link and licence
        else:
            columns.update(await _verified_link(session, user, github, columns["github_url"]))
    project = await own_project(session, user, slug)
    if project.is_demo:
        raise AppError(403, "sample_read_only", "Sample projects can only be deleted")

    current_images = {m.id: m for m in project.media if m.kind == "image"}
    current_video = next((m.url for m in project.media if m.kind == "video"), None)
    video = columns.get("demo_video_url", current_video)
    refs = data.images if data.images is not None else None
    if refs is not None:
        _check_refs(refs, kept_allowed=set(current_images))
    image_count = len(refs) if refs is not None else len(current_images)
    if not video and image_count == 0:
        raise _fail("media_required")

    removed: list[str] = []
    if refs is not None:
        images = await _images(session, user, refs, current_images)
        kept_ids = {r.media for r in refs if r.media is not None}
        removed = [
            m.storage_key for i, m in current_images.items() if i not in kept_ids and m.storage_key
        ]
    else:
        images = list(current_images.values())
    if "demo_video_url" in columns or refs is not None:
        project.media = _place(video, images)
    for name, value in columns.items():
        setattr(project, name, value)
    await session.commit()
    for key in removed:
        storage.delete(key)
    return await own_project(session, user, slug)


async def delete_project(session: AsyncSession, user: User, slug: str) -> None:
    project = await own_project(session, user, slug)
    keys = [m.storage_key for m in project.media if m.storage_key]
    await session.delete(project)
    await session.commit()
    for key in keys:
        storage.delete(key)


IMPORT_TAGS = 5


async def import_preview(
    session: AsyncSession, user: User, github: GitHubClient, url: str
) -> ImportPreview:
    """The add form's pre-fill from a repository the user owns or contributed to. Creates nothing.
    The link is checked before any GitHub call; no transaction stays open while GitHub answers."""
    parsed = parse_github_url(url)
    if parsed is None:
        raise _fail("invalid_github_url")
    account = await github_account(session, user.id)
    # End the read before GitHub answers (may take seconds). commit, not rollback: a rollback
    # would expire the loaded user (expire_on_commit=False keeps it on commit).
    await session.commit()
    owned = await check_ownership(github, account, url)
    try:
        languages = await github.languages(*parsed)
    except GitHubUnavailable:
        languages = {}  # the check passed; tags are only a convenience
    top = sorted(languages.items(), key=lambda item: -item[1])[:IMPORT_TAGS]
    repo = owned.repo
    homepage = repo.homepage.strip()
    return ImportPreview(
        title=repo.name[: TEXT["title"][0]],
        short_description=repo.description.strip()[: TEXT["short_description"][0]],
        tech_stack=[name[:MAX_TAG] for name, _ in top],
        live_url=homepage if _https_parts(homepage, ("http", "https")) else "",
        github_url=repo.html_url,
        license=repo.license_spdx,
        relation=owned.relation,
        github_login=owned.login,
    )
