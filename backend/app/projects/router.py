from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import current_developer
from app.core.db import get_session
from app.projects import editing, service
from app.projects.fields import FieldName
from app.projects.github import GitHubClient, get_github
from app.projects.schemas import (
    EditableProject,
    FeedPage,
    ImportPreview,
    ImportRequest,
    ProjectDetail,
    ProjectInput,
    ProjectUpdate,
)
from app.users.models import User

router = APIRouter(tags=["projects"])

DEFAULT_LIMIT = 24
MAX_LIMIT = 60

Session = Annotated[AsyncSession, Depends(get_session)]
Developer = Annotated[User, Depends(current_developer)]
GitHub = Annotated[GitHubClient, Depends(get_github)]


@router.get("/projects")
async def list_projects(
    session: Session,
    field: FieldName | None = None,
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
    cursor: str | None = None,
) -> FeedPage:
    return await service.list_feed(session, field=field, limit=limit, cursor=cursor)


@router.get("/projects/demo/{slug}")
async def get_demo_project(slug: str, session: Session) -> ProjectDetail:
    return ProjectDetail.from_project(await service.get_demo_project(session, slug))


@router.get("/users/{username}/projects")
async def list_user_projects(
    username: str,
    session: Session,
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
    cursor: str | None = None,
) -> FeedPage:
    return await service.list_user_projects(session, username, limit=limit, cursor=cursor)


@router.get("/users/{username}/projects/{slug}")
async def get_user_project(username: str, slug: str, session: Session) -> ProjectDetail:
    return ProjectDetail.from_project(await service.get_user_project(session, username, slug))


# A developer's own projects (add-project design, part 1). Another user's slug is 404.


@router.post("/me/projects/import")
async def import_from_github(
    data: ImportRequest,
    user: Developer,
    session: Session,
    github: GitHub,
) -> ImportPreview:
    """Pre-fill for the add form from the user's own repository (part 2). Creates nothing."""
    return await editing.import_preview(session, user, github, data.github_url)


@router.post("/me/projects", status_code=201)
async def create_project(
    data: ProjectInput, user: Developer, session: Session, github: GitHub
) -> ProjectDetail:
    return ProjectDetail.from_project(await editing.create_project(session, user, data, github))


@router.get("/me/projects/{slug}")
async def get_own_project(slug: str, user: Developer, session: Session) -> EditableProject:
    return EditableProject.from_project(await editing.own_project(session, user, slug))


@router.patch("/me/projects/{slug}")
async def update_project(
    slug: str, data: ProjectUpdate, user: Developer, session: Session, github: GitHub
) -> ProjectDetail:
    return ProjectDetail.from_project(
        await editing.update_project(session, user, slug, data, github)
    )


@router.delete("/me/projects/{slug}", status_code=204)
async def delete_project(slug: str, user: Developer, session: Session) -> None:
    await editing.delete_project(session, user, slug)
