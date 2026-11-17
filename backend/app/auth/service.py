"""Auth rules and queries: passwords, sessions, signup and login. No HTTP here.

Functions flush; the caller commits, except `resolve_session`, which commits its own
housekeeping (expired-row deletion, `last_seen_at`).
"""

import asyncio
import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from pwdlib import PasswordHash
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.email import Message, normalize_email
from app.auth.models import AuthIdentity, AuthSession, EmailToken, PasswordCredential
from app.core.config import get_settings
from app.core.errors import AppError
from app.users import service as users_service
from app.users.models import User

MIN_PASSWORD_LENGTH = 10
LAST_SEEN_INTERVAL = timedelta(hours=1)
VERIFY_TOKEN_LIFETIME = timedelta(hours=24)
RESET_TOKEN_LIFETIME = timedelta(hours=1)

_hasher = PasswordHash.recommended()
# Verified against when the account does not exist, so an unknown email costs the same time as
# a wrong password. Nothing ever accepts this plaintext.
_DUMMY_HASH = _hasher.hash("dummy password, never a real credential")


def _invalid_credentials() -> AppError:
    return AppError(401, "invalid_credentials", "Invalid email or password")


# --- passwords --------------------------------------------------------------------------------


def validate_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise AppError(
            422, "weak_password", f"Password must be at least {MIN_PASSWORD_LENGTH} characters"
        )


async def hash_password(password: str) -> str:
    """Argon2 is CPU-bound, so it runs in a worker thread instead of blocking the event loop."""
    return await asyncio.to_thread(_hasher.hash, password)


async def _verify(password: str, password_hash: str) -> bool:
    return await asyncio.to_thread(_hasher.verify, password, password_hash)


# --- sessions and tokens ----------------------------------------------------------------------


def hash_token(token: str) -> str:
    """Cookie and email tokens are stored only as their SHA-256 hex."""
    return hashlib.sha256(token.encode()).hexdigest()


async def start_session(
    db: AsyncSession, user_id: int, user_agent: str | None, old_token: str | None
) -> str:
    """Create a session and return its raw cookie token. A token the request already carried is
    deleted first, so a token known before login never survives it (session fixation)."""
    if old_token:
        await delete_session(db, old_token)
    now = datetime.now(UTC)
    token = secrets.token_urlsafe(32)
    db.add(
        AuthSession(
            user_id=user_id,
            token_hash=hash_token(token),
            expires_at=now + timedelta(days=get_settings().session_days),
            last_seen_at=now,
            user_agent=user_agent[:512] if user_agent else None,
        )
    )
    await db.flush()
    return token


async def delete_session(db: AsyncSession, token: str) -> None:
    await db.execute(delete(AuthSession).where(AuthSession.token_hash == hash_token(token)))


async def delete_user_sessions(db: AsyncSession, user_id: int) -> None:
    await db.execute(delete(AuthSession).where(AuthSession.user_id == user_id))


async def resolve_session(db: AsyncSession, token: str) -> AuthSession | None:
    """The live session for `token`, or None. An expired row is deleted; `last_seen_at` is
    refreshed at most once per hour. Commits."""
    row = await db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    if row is None:
        return None
    now = datetime.now(UTC)
    if row.expires_at <= now:
        await db.execute(delete(AuthSession).where(AuthSession.id == row.id))
        await db.commit()
        return None
    if now - row.last_seen_at >= LAST_SEEN_INTERVAL:
        await db.execute(
            update(AuthSession).where(AuthSession.id == row.id).values(last_seen_at=now)
        )
        await db.commit()
    return row


async def _issue_email_token(
    db: AsyncSession, user_id: int, purpose: str, lifetime: timedelta
) -> str:
    token = secrets.token_urlsafe(32)
    db.add(
        EmailToken(
            user_id=user_id,
            purpose=purpose,
            token_hash=hash_token(token),
            expires_at=datetime.now(UTC) + lifetime,
        )
    )
    await db.flush()
    return token


def _link(path: str, token: str) -> str:
    """Links point at the frontend (the page POSTs the token), never at the backend host."""
    return f"{get_settings().public_base_url.rstrip('/')}{path}?token={token}"


# --- signup, login, account -------------------------------------------------------------------


@dataclass
class Authenticated:
    user: User
    session_token: str


async def _email_identity(db: AsyncSession, email: str) -> AuthIdentity | None:
    return await db.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == "email", AuthIdentity.provider_user_id == email
        )
    )


async def signup(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    username: str,
    display_name: str,
    account_type: str,
    user_agent: str | None,
    old_token: str | None,
) -> tuple[Authenticated, Message]:
    """Create the user, an unverified email identity, the password and a session; return them
    with the verification email to send after the response."""
    email = normalize_email(email)
    validate_password(password)
    if await _email_identity(db, email):
        raise AppError(409, "email_taken", "An account with this email already exists")
    user = await users_service.create_user(
        db, username=username, display_name=display_name, account_type=account_type
    )
    try:
        # Savepoint: a concurrent signup with the same email trips the unique constraint
        # (the only integrity error this insert can raise) and must not abort the transaction.
        async with db.begin_nested():
            db.add(
                AuthIdentity(
                    user_id=user.id,
                    provider="email",
                    provider_user_id=email,
                    email=email,
                    email_verified=False,
                )
            )
            await db.flush()
    except IntegrityError as exc:
        raise AppError(409, "email_taken", "An account with this email already exists") from exc
    db.add(PasswordCredential(user_id=user.id, password_hash=await hash_password(password)))
    token = await _issue_email_token(db, user.id, "verify", VERIFY_TOKEN_LIFETIME)
    session_token = await start_session(db, user.id, user_agent, old_token)
    await db.commit()
    link = _link("/verify-email", token)
    message = Message(email, "Verify your email", f"Confirm your email address:\n{link}")
    return Authenticated(user, session_token), message


async def login(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    user_agent: str | None,
    old_token: str | None,
) -> Authenticated:
    """Every failure is the same 401. An unknown email (or an account with no password) still
    runs one verification against a dummy hash, so the response time does not reveal it."""
    row = (
        await db.execute(
            select(AuthIdentity.user_id, PasswordCredential.password_hash)
            .outerjoin(PasswordCredential, PasswordCredential.user_id == AuthIdentity.user_id)
            .where(
                AuthIdentity.provider == "email",
                AuthIdentity.provider_user_id == normalize_email(email),
            )
        )
    ).first()
    if row is None or row.password_hash is None:
        await _verify(password, _DUMMY_HASH)
        raise _invalid_credentials()
    if not await _verify(password, row.password_hash):
        raise _invalid_credentials()
    user = await users_service.get_by_id(db, row.user_id)
    session_token = await start_session(db, row.user_id, user_agent, old_token)
    await db.commit()
    return Authenticated(user, session_token)


async def account_summary(db: AsyncSession, user_id: int) -> tuple[str | None, bool, list[str]]:
    """(email, email_verified, providers) shown on /me. The email-provider identity wins; else
    a verified identity with an email; else any."""
    identities = (
        await db.scalars(select(AuthIdentity).where(AuthIdentity.user_id == user_id))
    ).all()
    with_email = [i for i in identities if i.email]
    with_email.sort(key=lambda i: (i.provider != "email", not i.email_verified))
    best = with_email[0] if with_email else None
    return (
        best.email if best else None,
        best.email_verified if best else False,
        sorted({i.provider for i in identities}),
    )
