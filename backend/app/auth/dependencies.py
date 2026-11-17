from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import service
from app.core.db import get_session
from app.core.errors import AppError
from app.users import service as users_service
from app.users.models import User

SESSION_COOKIE = "ph_session"

SessionToken = Annotated[str | None, Cookie(alias=SESSION_COOKIE)]


async def current_user_optional(
    db: Annotated[AsyncSession, Depends(get_session)], token: SessionToken = None
) -> User | None:
    """The signed-in user, or None. For routes that work for guests too."""
    if not token:
        return None
    session = await service.resolve_session(db, token)
    if session is None:
        return None
    return await users_service.get_by_id(db, session.user_id)


async def current_user(user: Annotated[User | None, Depends(current_user_optional)]) -> User:
    if user is None:
        raise AppError(401, "not_authenticated", "Not authenticated")
    return user
