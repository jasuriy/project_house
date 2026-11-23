"""HTTP layer for projects: reads the request, calls the service, returns the response.

No business rules here; they live in service.py.
"""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.github import GitHub, get_github
from app.projects import service
from app.projects.schemas import (
    ProjectOut,
    ProjectUpdate,
    RepoLink,
    UploadComplete,
    UploadRequest,
    UploadTicket,
    VideoOut,
)
from app.storage import Storage, get_storage

router = APIRouter(prefix="/api/v1/projects")

Session = Annotated[AsyncSession, Depends(get_session)]
Files = Annotated[Storage, Depends(get_storage)]
Repos = Annotated[GitHub, Depends(get_github)]
UploadKind = Literal["video", "poster"]


@router.post("", status_code=201)
async def create_project(session: Session, storage: Files) -> ProjectOut:
    return service.to_out(await service.create_draft(session), storage)


# Address routes come before "/{project_id}", so "by-slug" is never read as an id.
@router.get("/by-slug/{slug}")
async def get_published_project(slug: str, session: Session, storage: Files) -> ProjectOut:
    return service.to_out(await service.get_published(session, slug), storage)


@router.get("/by-slug/{slug}/video")
async def get_video_links(slug: str, session: Session, storage: Files) -> VideoOut:
    """Fresh signed links, for a project page that stayed open longer than the links last."""
    return await service.get_published_video(session, storage, slug)


@router.get("/{project_id}")
async def get_project(project_id: uuid.UUID, session: Session, storage: Files) -> ProjectOut:
    return service.to_out(await service.get_project(session, project_id), storage)


@router.patch("/{project_id}")
async def update_project(
    project_id: uuid.UUID, changes: ProjectUpdate, session: Session, storage: Files
) -> ProjectOut:
    project = await service.update_draft(
        session, project_id, changes.model_dump(exclude_unset=True)
    )
    return service.to_out(project, storage)


@router.post("/{project_id}/uploads/{kind}/url")
async def create_upload(
    project_id: uuid.UUID,
    kind: UploadKind,
    request: UploadRequest,
    session: Session,
    storage: Files,
) -> UploadTicket:
    return await service.create_upload(session, storage, project_id, kind, request)


@router.post("/{project_id}/uploads/{kind}/complete")
async def complete_upload(
    project_id: uuid.UUID, kind: UploadKind, done: UploadComplete, session: Session, storage: Files
) -> ProjectOut:
    project = await service.complete_upload(session, storage, project_id, kind, done)
    return service.to_out(project, storage)


@router.post("/{project_id}/repo")
async def link_repo(
    project_id: uuid.UUID, link: RepoLink, session: Session, storage: Files, github: Repos
) -> ProjectOut:
    project = await service.link_repo(session, github, project_id, link.url)
    return service.to_out(project, storage)


@router.post("/{project_id}/publish")
async def publish_project(project_id: uuid.UUID, session: Session, storage: Files) -> ProjectOut:
    return service.to_out(await service.publish(session, project_id), storage)
