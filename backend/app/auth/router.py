import logging
from typing import Annotated

from authlib.integrations.starlette_client.apps import StarletteOAuth2App
from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import oauth, service
from app.auth.dependencies import SESSION_COOKIE, SessionToken, current_user
from app.auth.email import EmailSender, get_email_sender
from app.auth.oauth import get_oauth_client
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

DbSession = Annotated[AsyncSession, Depends(get_session)]


def _public_url(path: str = "") -> str:
    return get_settings().public_base_url.rstrip("/") + path


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
        await service.logout(db, token)
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


def _oauth_failed(provider: str, exc: Exception) -> Response:
    """Redirect a failed OAuth step to the login page: the user is in a browser, not an API
    client, and the URL carries nothing secret. Only the class name is logged because provider
    error text can echo codes and tokens."""
    logger.warning("OAuth step failed (%s: %s)", provider, type(exc).__name__)
    return RedirectResponse(_public_url("/login?error=oauth_failed"), status_code=302)


@router.get("/oauth/{provider}/start")
async def oauth_start(
    provider: str,
    request: Request,
    client: Annotated[StarletteOAuth2App, Depends(get_oauth_client)],
) -> Response:
    # The callback URL is built from PUBLIC_BASE_URL, never from the request's Host: behind the
    # frontend proxy the backend sees its own host, which the provider would reject.
    try:
        return await client.authorize_redirect(
            request, _public_url(f"/api/v1/auth/oauth/{provider}/callback")
        )
    except Exception as exc:  # noqa: BLE001  (e.g. discovery unreachable)
        return _oauth_failed(provider, exc)


@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    request: Request,
    db: DbSession,
    client: Annotated[StarletteOAuth2App, Depends(get_oauth_client)],
    token: SessionToken = None,
) -> Response:
    """Any failure (cancelled, forged state, failed exchange) is a redirect to the login page;
    the user is in a browser, not an API client, and the URL carries nothing secret."""
    try:
        oauth_token = await client.authorize_access_token(request)
        profile = await oauth.fetch_profile(provider, client, oauth_token)
    except Exception as exc:  # noqa: BLE001  (every failure here means the same redirect)
        return _oauth_failed(provider, exc)
    result = await service.oauth_login(
        db,
        provider=provider,
        profile=profile,
        user_agent=request.headers.get("user-agent"),
        old_token=token,
    )
    if result.kind == "account_exists":
        # The address belongs to an existing account: its owner must log in and connect from
        # there (architecture section 6). Nothing was created, linked or revoked.
        return RedirectResponse(
            _public_url(f"/login?error=account_exists&provider={provider}"), status_code=302
        )
    response = RedirectResponse(
        _public_url("/onboarding" if result.kind == "new_account" else ""), status_code=302
    )
    if result.session_token:  # "connected" keeps the session the browser already has
        _set_session_cookie(response, result.session_token)
    return response
