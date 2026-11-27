"""HTTP layer for projects: reads the request, calls the service, returns the response.

No business rules here; they live in service.py.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app import catalog
from app.db import get_session
from app.github import GitHub, RepoSnapshot, get_github
from app.previews import PreviewStarter, get_preview_starter, start_quietly
from app.projects import service
from app.projects.schemas import (
    Feed,
    ProjectCreate,
    ProjectOut,
    RepoLink,
    UploadRequest,
    UploadTicket,
    VideoOut,
)
from app.storage import Storage, get_storage

router = APIRouter(prefix="/api/v1")

Session = Annotated[AsyncSession, Depends(get_session)]
Files = Annotated[Storage, Depends(get_storage)]
Repos = Annotated[GitHub, Depends(get_github)]
Previews = Annotated[PreviewStarter, Depends(get_preview_starter)]
UploadKind = Literal["video", "poster"]
Category = Literal[tuple(catalog.CATEGORIES)]  # type: ignore[valid-type]


# --- used by the upload page before Render; nothing is stored -------------------------------


@router.post("/uploads/{kind}/url")
async def create_upload(kind: UploadKind, request: UploadRequest, storage: Files) -> UploadTicket:
    return service.create_upload(storage, kind, request)


@router.post("/repos/preview")
async def preview_repo(link: RepoLink, github: Repos) -> RepoSnapshot:
    return await service.preview_repo(github, link.url)


# --- Render, and the project page -------------------------------------------------------------


@router.post("/projects", status_code=201)
async def create_project(
    data: ProjectCreate, session: Session, storage: Files, github: Repos, previews: Previews
) -> ProjectOut:
    project = await service.create_project(session, storage, github, data)
    await start_quietly(previews, project.id)  # the feed's short copy is made in the background
    return service.to_out(project, storage)


@router.get("/projects")
async def list_projects(
    session: Session,
    storage: Files,
    category: Category | None = None,
    q: Annotated[str | None, Query(max_length=80)] = None,
    limit: Annotated[int, Query(ge=1, le=96)] = 48,
) -> Feed:
    """The feed: newest first; optionally one category and a search (name, description, stack)."""
    return await service.list_published(session, storage, category, q, limit)


@router.get("/projects/by-slug/{slug}")
async def get_published_project(slug: str, session: Session, storage: Files) -> ProjectOut:
    return service.to_out(await service.get_published(session, slug), storage)


@router.get("/projects/by-slug/{slug}/video")
async def get_video_links(slug: str, session: Session, storage: Files) -> VideoOut:
    """Fresh signed links, for a project page that stayed open longer than the links last."""
    return await service.get_published_video(session, storage, slug)
