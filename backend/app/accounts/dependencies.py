"""Who is asking: the login cookie and the user it belongs to, for any router that needs it."""

from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounts import service
from app.accounts.models import User
from app.db import get_session
from app.errors import AppError

COOKIE = "ph_session"

SessionToken = Annotated[str | None, Cookie(alias=COOKIE)]


async def optional_user(
    session: Annotated[AsyncSession, Depends(get_session)], token: SessionToken = None
) -> User | None:
    """The logged-in user, or None for a visitor."""
    return await service.user_for_token(session, token)


async def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    """The logged-in user; a visitor gets 401."""
    if user is None:
        raise AppError(401, "not_logged_in", "Log in first")
    return user
