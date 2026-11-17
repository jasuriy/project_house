"""Constants and small helpers shared by the auth tests (fixtures live in auth_fixtures)."""

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import AuthSession

PASSWORD = "correct horse battery"
SIGNUP = {
    "email": "bek@example.com",
    "password": PASSWORD,
    "username": "bek",
    "display_name": "Bek",
    "account_type": "developer",
}


def signup_body(**overrides: str) -> dict[str, str]:
    return {**SIGNUP, **overrides}


async def session_rows(db_session: AsyncSession) -> list[AuthSession]:
    query = select(AuthSession).order_by(AuthSession.id).execution_options(populate_existing=True)
    return list((await db_session.scalars(query)).all())


def set_cookie_header(response: httpx.Response, name: str) -> str:
    """The raw Set-Cookie header for `name`."""
    for header in response.headers.get_list("set-cookie"):
        if header.startswith(f"{name}="):
            return header
    raise AssertionError(f"no Set-Cookie for {name}")
