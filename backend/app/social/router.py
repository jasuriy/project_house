from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import current_user, current_user_optional
from app.core.db import get_session
from app.projects.schemas import FeedPage
from app.social import service
from app.social.schemas import CommentInput, CommentOut, CommentPage, ReportInput
from app.users.models import User

router = APIRouter(tags=["social"])

Session = Annotated[AsyncSession, Depends(get_session)]
Me = Annotated[User, Depends(current_user)]
Viewer = Annotated[User | None, Depends(current_user_optional)]


# Explicit paths: a pattern like /me/{kind}/{id} would also catch /me/projects/<slug> and
# /me/uploads/<id> and answer 422 for them.
@router.put("/me/likes/{project_id}", status_code=204)
async def like(project_id: int, user: Me, session: Session) -> None:
    await service.mark(session, "likes", user.id, project_id)


@router.delete("/me/likes/{project_id}", status_code=204)
async def unlike(project_id: int, user: Me, session: Session) -> None:
    await service.unmark(session, "likes", user.id, project_id)


@router.put("/me/saves/{project_id}", status_code=204)
async def save(project_id: int, user: Me, session: Session) -> None:
    await service.mark(session, "saves", user.id, project_id)


@router.delete("/me/saves/{project_id}", status_code=204)
async def unsave(project_id: int, user: Me, session: Session) -> None:
    await service.unmark(session, "saves", user.id, project_id)


@router.get("/me/saved")
async def my_saved(
    user: Me,
    session: Session,
    limit: Annotated[int, Query(ge=1, le=60)] = 24,
    cursor: str | None = None,
) -> FeedPage:
    return await service.my_list(session, "saves", user.id, limit=limit, cursor=cursor)


@router.get("/me/liked")
async def my_liked(
    user: Me,
    session: Session,
    limit: Annotated[int, Query(ge=1, le=60)] = 24,
    cursor: str | None = None,
) -> FeedPage:
    return await service.my_list(session, "likes", user.id, limit=limit, cursor=cursor)


@router.get("/projects/{project_id}/comments")
async def comments(
    project_id: int,
    session: Session,
    viewer: Viewer,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    cursor: str | None = None,
) -> CommentPage:
    viewer_id = viewer.id if viewer else None
    return await service.list_comments(session, project_id, viewer_id, limit=limit, cursor=cursor)


@router.post("/projects/{project_id}/comments", status_code=201)
async def add_comment(
    project_id: int, data: CommentInput, user: Me, session: Session
) -> CommentOut:
    return await service.add_comment(session, user, project_id, data.body)


@router.delete("/me/comments/{comment_id}", status_code=204)
async def delete_comment(comment_id: int, user: Me, session: Session) -> None:
    await service.delete_comment(session, user, comment_id)


@router.post("/me/reports")
async def report(data: ReportInput, user: Me, session: Session) -> Response:
    """201 for a new report, 200 when this person already reported the item."""
    created = await service.report(session, user, data)
    return Response(status_code=201 if created else 200)
