"""Likes, saves, comments and reports (spec step 4)."""

from sqlalchemy import delete, func, select, text, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.errors import AppError
from app.core.pagination import decode_cursor, encode_cursor
from app.media import storage
from app.projects.models import Project
from app.projects.schemas import FeedPage, ProjectCard
from app.social.models import REPORT_REASONS, Comment, ProjectLike, ProjectSave, Report
from app.social.schemas import CommentAuthor, CommentOut, CommentPage, ReportInput
from app.users.models import User

MARKS = {"likes": ProjectLike, "saves": ProjectSave}
MAX_COMMENT, MAX_NOTE = 1000, 500


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


# ---- comments ------------------------------------------------------------------------------


async def _project(session: AsyncSession, project_id: int) -> Project:
    project = await session.get(Project, project_id)
    if project is None:
        raise AppError(404, "project_not_found", "Project not found")
    return project


def _storable(text: str) -> bool:
    """PostgreSQL text takes neither NUL nor a lone UTF-16 surrogate (JSON can carry both)."""
    return "\x00" not in text and not any("\ud800" <= ch <= "\udfff" for ch in text)


def _comment_body(value: str) -> str:
    body = value.strip()
    if not body or len(body) > MAX_COMMENT or not _storable(body):
        raise AppError(422, "invalid_comment", "A comment is 1 to 1000 characters")
    return body


def _comment_out(comment: Comment, author: User, can_delete: bool) -> CommentOut:
    avatar = storage.url(author.avatar_key) if author.avatar_key else None
    return CommentOut(
        id=comment.id,
        body=comment.body,
        created_at=comment.created_at,
        author=CommentAuthor(
            name=author.display_name, url=f"/{author.username}", avatar_url=avatar
        ),
        can_delete=can_delete,
    )


def _may_delete(viewer_id: int | None, author_id: int, project_owner_id: int | None) -> bool:
    """The author, or the project's owner (an ownerless sample has none)."""
    return viewer_id is not None and viewer_id in (author_id, project_owner_id)


async def comment_count(session: AsyncSession, project_id: int) -> int:
    count = await session.scalar(select(func.count()).where(Comment.project_id == project_id))
    return count or 0


async def list_comments(
    session: AsyncSession,
    project_id: int,
    viewer_id: int | None,
    *,
    limit: int,
    cursor: str | None,
) -> CommentPage:
    """Oldest first, so a conversation reads top to bottom."""
    project = await _project(session, project_id)
    stmt = (
        select(Comment, User)
        .join(User, User.id == Comment.author_id)
        .where(Comment.project_id == project_id)
        .order_by(Comment.created_at, Comment.id)
        .limit(limit + 1)
    )
    if cursor is not None:
        created_at, comment_id = decode_cursor(cursor)
        stmt = stmt.where(tuple_(Comment.created_at, Comment.id) > tuple_(created_at, comment_id))
    rows = (await session.execute(stmt)).all()
    page, has_more = rows[:limit], len(rows) > limit
    last = page[-1][0] if has_more else None
    return CommentPage(
        items=[
            _comment_out(c, author, _may_delete(viewer_id, c.author_id, project.owner_id))
            for c, author in page
        ],
        next_cursor=encode_cursor(last.created_at, last.id) if last else None,
    )


async def add_comment(session: AsyncSession, user: User, project_id: int, value: str) -> CommentOut:
    body = _comment_body(value)
    await _project(session, project_id)
    row = (
        await session.execute(
            insert(Comment)
            .values(project_id=project_id, author_id=user.id, body=body)
            .returning(Comment.id, Comment.created_at)
        )
    ).one()
    await session.commit()
    comment = Comment(id=row.id, project_id=project_id, author_id=user.id, body=body)
    comment.created_at = row.created_at
    return _comment_out(comment, user, can_delete=True)


async def delete_comment(session: AsyncSession, user: User, comment_id: int) -> None:
    """404 for a comment you may not delete, so strangers learn nothing about it."""
    row = (
        await session.execute(
            select(Comment.author_id, Project.owner_id)
            .join(Project, Project.id == Comment.project_id)
            .where(Comment.id == comment_id)
        )
    ).one_or_none()
    if row is None or not _may_delete(user.id, row.author_id, row.owner_id):
        raise AppError(404, "comment_not_found", "Comment not found")
    await session.execute(delete(Comment).where(Comment.id == comment_id))
    await session.commit()


# ---- reports -------------------------------------------------------------------------------


def _bad_report() -> AppError:
    return AppError(422, "invalid_report", "Invalid report")


def _note(value: str | None) -> str | None:
    note = (value or "").strip()
    if len(note) > MAX_NOTE or not _storable(note):
        raise _bad_report()
    return note or None


async def _username(session: AsyncSession, user_id: int | None) -> str | None:
    if user_id is None:
        return None
    return await session.scalar(select(User.username).where(User.id == user_id))


async def report(session: AsyncSession, user: User, data: ReportInput) -> bool:
    """Record a report; False when this person already reported the item (no new row)."""
    if (data.project_id is None) == (data.comment_id is None) or data.reason not in REPORT_REASONS:
        raise _bad_report()
    note = _note(data.note)
    if data.comment_id is not None:
        comment = await session.get(Comment, data.comment_id)
        if comment is None:
            raise AppError(404, "comment_not_found", "Comment not found")
        kind, project_id, snapshot = "comment", comment.project_id, comment.body
        target_user_id: int | None = comment.author_id
        # Matches the partial unique index uq_reports_reporter_comment.
        conflict = (["reporter_id", "comment_id"], text("comment_id IS NOT NULL"))
    else:
        project = await _project(session, data.project_id)  # type: ignore[arg-type]
        kind, project_id, snapshot = "project", project.id, project.title
        target_user_id = project.owner_id  # None for an ownerless sample
        # Matches the partial unique index uq_reports_reporter_project.
        conflict = (
            ["reporter_id", "project_id"],
            text("target_kind = 'project' AND project_id IS NOT NULL"),
        )
    created = await session.scalar(
        insert(Report)
        .values(
            reporter_id=user.id,
            target_kind=kind,
            project_id=project_id,
            comment_id=data.comment_id,
            reason=data.reason,
            note=note,
            snapshot=snapshot,
            target_user_id=target_user_id,
            target_username=await _username(session, target_user_id),
        )
        .on_conflict_do_nothing(index_elements=conflict[0], index_where=conflict[1])
        .returning(Report.id)
    )
    await session.commit()
    return created is not None
