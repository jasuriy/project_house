from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import service
from app.auth.dependencies import SESSION_COOKIE, SessionToken, current_user
from app.auth.email import EmailSender, get_email_sender
from app.auth.schemas import (
    AccountResponse,
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenRequest,
)
from app.core.config import get_settings
from app.core.db import get_session
from app.users.models import User
from app.users.schemas import UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])

DbSession = Annotated[AsyncSession, Depends(get_session)]


def _set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.session_days * 86400,
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.app_env == "production",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        SESSION_COOKIE,
        path="/",
        httponly=True,
        samesite="lax",
        secure=get_settings().app_env == "production",
    )


async def _account(db: AsyncSession, user: User) -> AccountResponse:
    email, email_verified, providers = await service.account_summary(db, user.id)
    return AccountResponse(
        **UserPublic.model_validate(user).model_dump(),
        email=email,
        email_verified=email_verified,
        providers=providers,
    )


@router.post("/signup", status_code=201)
async def signup(
    body: SignupRequest,
    request: Request,
    response: Response,
    db: DbSession,
    background: BackgroundTasks,
    sender: Annotated[EmailSender, Depends(get_email_sender)],
    token: SessionToken = None,
) -> AccountResponse:
    auth, message = await service.signup(
        db,
        email=body.email,
        password=body.password,
        username=body.username,
        display_name=body.display_name,
        account_type=body.account_type,
        user_agent=request.headers.get("user-agent"),
        old_token=token,
    )
    background.add_task(sender.send, *message)
    _set_session_cookie(response, auth.session_token)
    return await _account(db, auth.user)


@router.post("/login")
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: DbSession,
    token: SessionToken = None,
) -> AccountResponse:
    auth = await service.login(
        db,
        email=body.email,
        password=body.password,
        user_agent=request.headers.get("user-agent"),
        old_token=token,
    )
    _set_session_cookie(response, auth.session_token)
    return await _account(db, auth.user)


@router.post("/logout", status_code=204)
async def logout(db: DbSession, token: SessionToken = None) -> Response:
    if token:
        await service.delete_session(db, token)
        await db.commit()
    response = Response(status_code=204)
    _clear_session_cookie(response)
    return response


@router.get("/me")
async def me(db: DbSession, user: Annotated[User, Depends(current_user)]) -> AccountResponse:
    return await _account(db, user)


@router.post("/email/verify", status_code=204)
async def verify_email(body: TokenRequest, db: DbSession) -> None:
    await service.verify_email(db, body.token)


@router.post("/password/forgot", status_code=202)
async def forgot_password(
    body: ForgotPasswordRequest,
    db: DbSession,
    background: BackgroundTasks,
    sender: Annotated[EmailSender, Depends(get_email_sender)],
) -> None:
    """202 whether or not the email has an account (no account enumeration). The mail is sent
    after the response, so its delay does not tell the two cases apart either."""
    message = await service.request_password_reset(db, body.email)
    if message:
        background.add_task(sender.send, *message)


@router.post("/password/reset", status_code=204)
async def reset_password(body: ResetPasswordRequest, db: DbSession) -> None:
    await service.reset_password(db, body.token, body.new_password)
