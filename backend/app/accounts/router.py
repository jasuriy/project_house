"""HTTP layer for accounts: the login cookie is set and cleared here; the rules live in
service.py.

The browser calls these through the site (/api/* is forwarded by Next.js), so the cookie
belongs to the site and is sent back with every later /api/* request.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounts import service
from app.accounts.dependencies import COOKIE, SessionToken, current_user
from app.accounts.models import User
from app.accounts.schemas import LogIn, Me, SignUp
from app.config import get_settings
from app.db import get_session

router = APIRouter(prefix="/api/v1/auth")

DbSession = Annotated[AsyncSession, Depends(get_session)]


def _cookie_rules() -> dict:
    return {
        "path": "/",
        "httponly": True,  # page scripts cannot read it
        "secure": get_settings().site_origin.startswith("https://"),
        "samesite": "lax",  # not sent on cross-site POSTs
    }


def _set_cookie(response: Response, token: str) -> None:
    max_age = int(service.SESSION_LIFETIME.total_seconds())
    response.set_cookie(COOKIE, token, max_age=max_age, **_cookie_rules())


@router.post("/signup", status_code=201)
async def sign_up(data: SignUp, session: DbSession, response: Response) -> Me:
    user, token = await service.sign_up(session, data)
    _set_cookie(response, token)
    return Me.model_validate(user, from_attributes=True)


@router.post("/login")
async def log_in(data: LogIn, session: DbSession, response: Response) -> Me:
    user, token = await service.log_in(session, data)
    _set_cookie(response, token)
    return Me.model_validate(user, from_attributes=True)


@router.post("/logout", status_code=204)
async def log_out(session: DbSession, response: Response, token: SessionToken = None) -> None:
    await service.log_out(session, token)
    response.delete_cookie(COOKIE, **_cookie_rules())


@router.get("/me")
async def me(user: Annotated[User, Depends(current_user)]) -> Me:
    return Me.model_validate(user, from_attributes=True)
