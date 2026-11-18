"""Likes, saves, comments and reports (spec step 4)."""

from sqlalchemy import delete, func, select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.errors import AppError
from app.core.pagination import decode_cursor, encode_cursor
from app.projects.models import Project
from app.projects.schemas import FeedPage, ProjectCard
from app.social.models import ProjectLike, ProjectSave

MARKS = {"likes": ProjectLike, "saves": ProjectSave}


async def like_counts(session: AsyncSession, project_ids: list[int]) -> dict[int, int]:
    """Likes per project for a page of cards, in one query."""
    if not project_ids:
        return {}
    rows = await session.execute(
        select(ProjectLike.project_id, func.count())
        .where(ProjectLike.project_id.in_(project_ids))
        .group_by(ProjectLike.project_id)
    )
    return {project_id: count for project_id, count in rows.all()}


async def viewer_state(
    session: AsyncSession, user_id: int | None, project_id: int
) -> tuple[bool, bool]:
    """(liked, saved) for the viewer; both False for a guest."""
    if user_id is None:
        return False, False
    liked = await session.scalar(
        select(func.count()).where(
            ProjectLike.user_id == user_id, ProjectLike.project_id == project_id
        )
    )
    saved = await session.scalar(
        select(func.count()).where(
            ProjectSave.user_id == user_id, ProjectSave.project_id == project_id
        )
    )
    return bool(liked), bool(saved)


async def like_total(session: AsyncSession, owner_id: int) -> int:
    """Likes received by all of a person's projects (the profile's stat)."""
    total = await session.scalar(
        select(func.count())
        .select_from(ProjectLike)
        .join(Project, Project.id == ProjectLike.project_id)
        .where(Project.owner_id == owner_id)
    )
    return total or 0


async def mark(session: AsyncSession, kind: str, user_id: int, project_id: int) -> None:
    """Like or save; doing it twice is fine (no read-then-write, so two quick clicks cannot fail)."""
    if await session.get(Project, project_id) is None:
        raise AppError(404, "project_not_found", "Project not found")
    table = MARKS[kind]
    await session.execute(
        insert(table)
        .values(user_id=user_id, project_id=project_id)
        .on_conflict_do_nothing(index_elements=["user_id", "project_id"])
    )
    await session.commit()


async def unmark(session: AsyncSession, kind: str, user_id: int, project_id: int) -> None:
    table = MARKS[kind]
    await session.execute(
        delete(table).where(table.user_id == user_id, table.project_id == project_id)
    )
    await session.commit()


async def my_list(
    session: AsyncSession, kind: str, user_id: int, *, limit: int, cursor: str | None
) -> FeedPage:
    """The viewer's own saved or liked projects, newest saved/liked first."""
    table = MARKS[kind]
    stmt = (
        select(Project, table.created_at)
        .join(table, table.project_id == Project.id)
        .where(table.user_id == user_id)
        .options(selectinload(Project.media), joinedload(Project.owner))
        .order_by(table.created_at.desc(), table.project_id.desc())
        .limit(limit + 1)
    )
    if cursor is not None:
        marked_at, project_id = decode_cursor(cursor)
        stmt = stmt.where(
            tuple_(table.created_at, table.project_id) < tuple_(marked_at, project_id)
        )
    rows = (await session.execute(stmt)).all()
    page, has_more = rows[:limit], len(rows) > limit
    counts = await like_counts(session, [project.id for project, _ in page])
    next_cursor = encode_cursor(page[-1][1], page[-1][0].id) if has_more else None
    return FeedPage(
        items=[ProjectCard.from_project(p, like_count=counts.get(p.id, 0)) for p, _ in page],
        next_cursor=next_cursor,
    )
