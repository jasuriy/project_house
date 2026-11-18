from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import AppError
from app.users import service
from app.users.schemas import ProfileResponse, UserPublic

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{username}")
async def get_user(
    username: str, session: Annotated[AsyncSession, Depends(get_session)]
) -> ProfileResponse:
    user = await service.get_by_username(session, username)
    if user is None:
        raise AppError(404, "user_not_found", "User not found")
    return ProfileResponse(
        **UserPublic.of(user).model_dump(),
        project_count=await service.count_projects(session, user.id),
    )
