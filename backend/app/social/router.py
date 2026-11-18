from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import current_user
from app.core.db import get_session
from app.projects.schemas import FeedPage
from app.social import service
from app.users.models import User

router = APIRouter(tags=["social"])

Session = Annotated[AsyncSession, Depends(get_session)]
Me = Annotated[User, Depends(current_user)]


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
