from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.errors import AppError
from app.core.pagination import decode_cursor, encode_cursor
from app.projects.models import Project
from app.projects.schemas import FeedPage, ProjectCard
from app.users import service as users_service

# Every query names what it loads: relationships are lazy="raise" (no lazy loads under asyncio).
_LOAD = (selectinload(Project.media), joinedload(Project.owner))


async def list_feed(
    session: AsyncSession,
    *,
    field: str | None,
    limit: int,
    cursor: str | None,
) -> FeedPage:
    """Newest first by (published_at, id). Keyset paging: one extra row tells if a page follows."""
    stmt = (
        select(Project)
        .options(*_LOAD)
        .order_by(Project.published_at.desc(), Project.id.desc())
        .limit(limit + 1)
    )
    if field is not None:
        stmt = stmt.where(Project.field == field)
    if cursor is not None:
        published_at, id_ = decode_cursor(cursor)
        stmt = stmt.where(tuple_(Project.published_at, Project.id) < tuple_(published_at, id_))
    rows = list(await session.scalars(stmt))
    page, has_more = rows[:limit], len(rows) > limit
    next_cursor = encode_cursor(page[-1].published_at, page[-1].id) if has_more else None
    return FeedPage(items=[ProjectCard.from_project(p) for p in page], next_cursor=next_cursor)


async def get_demo_project(session: AsyncSession, slug: str) -> Project:
    stmt = select(Project).options(*_LOAD).where(Project.is_demo, Project.slug == slug)
    project = await session.scalar(stmt)
    if project is None:
        raise AppError(404, "project_not_found", "Project not found")
    return project


async def get_user_project(session: AsyncSession, username: str, slug: str) -> Project:
    user = await users_service.get_by_username(session, username)
    if user is None:
        raise AppError(404, "user_not_found", "User not found")
    stmt = select(Project).options(*_LOAD).where(Project.owner_id == user.id, Project.slug == slug)
    project = await session.scalar(stmt)
    if project is None:
        raise AppError(404, "project_not_found", "Project not found")
    return project
