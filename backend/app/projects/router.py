"""HTTP layer for projects: reads the request, calls the service, returns the response.

No business rules here; they live in service.py.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.github import GitHub, RepoSnapshot, get_github
from app.projects import service
from app.projects.schemas import (
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
UploadKind = Literal["video", "poster"]


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
    data: ProjectCreate, session: Session, storage: Files, github: Repos
) -> ProjectOut:
    return service.to_out(await service.create_project(session, storage, github, data), storage)


@router.get("/projects/by-slug/{slug}")
async def get_published_project(slug: str, session: Session, storage: Files) -> ProjectOut:
    return service.to_out(await service.get_published(session, slug), storage)


@router.get("/projects/by-slug/{slug}/video")
async def get_video_links(slug: str, session: Session, storage: Files) -> VideoOut:
    """Fresh signed links, for a project page that stayed open longer than the links last."""
    return await service.get_published_video(session, storage, slug)
