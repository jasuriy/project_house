from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.projects import service
from app.projects.fields import FieldName
from app.projects.schemas import FeedPage, ProjectDetail

router = APIRouter(tags=["projects"])

DEFAULT_LIMIT = 24
MAX_LIMIT = 60

Session = Annotated[AsyncSession, Depends(get_session)]


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
