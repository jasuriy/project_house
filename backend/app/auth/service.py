"""Auth rules and queries: passwords, sessions, signup and login. No HTTP here.

The public entry points (signup, login, logout, oauth_login, verify_email,
request_password_reset, reset_password, resolve_session) commit their own unit of work. The
helpers they call (start_session, delete_session, delete_user_sessions, token issuing) only
flush, so one entry point stays one transaction.
"""

import asyncio
import hashlib
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

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
from app.users.usernames import RESERVED_USERNAMES

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
            user_agent=user_agent,
        )
    )
    await db.flush()
    return token


async def delete_session(db: AsyncSession, token: str) -> None:
    await db.execute(delete(AuthSession).where(AuthSession.token_hash == hash_token(token)))


async def logout(db: AsyncSession, token: str) -> None:
    await delete_session(db, token)
    await db.commit()


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
    # Any identity (email, Google or GitHub) holding this address blocks the signup.
    if await db.scalar(select(AuthIdentity.id).where(AuthIdentity.email == email).limit(1)):
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


# --- email verification and password reset ----------------------------------------------------


async def _consume_token(
    db: AsyncSession, token: str, purpose: str, only_user_id: int | None = None
) -> int:
    """Mark a matching, unused, unexpired token of `purpose` as used and return its user id.

    One atomic UPDATE, so two concurrent requests cannot both consume the same token. With
    `only_user_id`, a token of any other user does not match and stays unused. Raises
    AppError(400, "token_invalid") for an unknown, used, expired, wrong-purpose or (with
    `only_user_id`) foreign token."""
    now = datetime.now(UTC)
    conditions = [
        EmailToken.token_hash == hash_token(token),
        EmailToken.purpose == purpose,
        EmailToken.used_at.is_(None),
        EmailToken.expires_at > now,
    ]
    if only_user_id is not None:
        conditions.append(EmailToken.user_id == only_user_id)
    user_id = await db.scalar(
        update(EmailToken).where(*conditions).values(used_at=now).returning(EmailToken.user_id)
    )
    if user_id is None:
        raise AppError(400, "token_invalid", "This link is invalid or has expired")
    return user_id


async def verify_email(db: AsyncSession, token: str, session_user_id: int) -> None:
    """Verify the signed-in user's email. Clicking the mailed link proves mailbox ownership, not
    that the clicker created the account, so the token only counts for the account's own session
    (architecture section 6); anyone else's token stays unused."""
    user_id = await _consume_token(db, token, "verify", only_user_id=session_user_id)
    await db.execute(
        update(AuthIdentity)
        .where(AuthIdentity.user_id == user_id, AuthIdentity.provider == "email")
        .values(email_verified=True)
    )
    await db.commit()


async def request_password_reset(db: AsyncSession, email: str) -> Message | None:
    """The reset email to send, or None when no account has this email (the caller answers
    the same either way)."""
    email = normalize_email(email)
    identity = await _email_identity(db, email)
    if identity is None:
        return None
    token = await _issue_email_token(db, identity.user_id, "reset", RESET_TOKEN_LIFETIME)
    await db.commit()
    link = _link("/reset-password", token)
    return Message(email, "Reset your password", f"Choose a new password:\n{link}")


async def reset_password(db: AsyncSession, token: str, new_password: str) -> None:
    """Set a new password and sign the user out everywhere. The password is checked before the
    token is consumed, so a weak password does not burn the link."""
    validate_password(new_password)
    user_id = await _consume_token(db, token, "reset")
    await db.merge(
        PasswordCredential(user_id=user_id, password_hash=await hash_password(new_password))
    )
    await delete_user_sessions(db, user_id)
    email_identity = await db.scalar(
        select(AuthIdentity).where(
            AuthIdentity.user_id == user_id, AuthIdentity.provider == "email"
        )
    )
    if email_identity and not email_identity.email_verified:
        # Receiving this mail proves the address is the account holder's, but whoever created
        # the account while it was unverified (a squatter) may have attached provider identities.
        email_identity.email_verified = True
        await db.execute(
            delete(AuthIdentity).where(
                AuthIdentity.user_id == user_id, AuthIdentity.provider != "email"
            )
        )
    # Any other reset link already mailed to this user must stop working too.
    await db.execute(
        update(EmailToken)
        .where(
            EmailToken.user_id == user_id,
            EmailToken.purpose == "reset",
            EmailToken.used_at.is_(None),
        )
        .values(used_at=datetime.now(UTC))
    )
    await db.commit()


# --- OAuth login ------------------------------------------------------------------------------


@dataclass
class OAuthProfile:
    """What a provider told us about the person who just signed in."""

    provider_user_id: str
    email: str | None
    email_verified: bool
    username_hint: str  # provider login or email local part; sanitized into a username
    display_name: str | None


@dataclass
class OAuthOutcome:
    """What the callback did. `session_token` is set only when a new session was issued."""

    kind: Literal[
        "logged_in",
        "new_account",
        "account_exists",
        "connected",
        "unchanged",
        "provider_in_use",
        "provider_already_connected",
        "verify_email_first",
    ]
    session_token: str | None = None


async def _free_username(db: AsyncSession, hint: str) -> str:
    """A valid, unreserved, unused username derived from `hint`, with a numeric suffix on a
    clash. The base is cut to 24 characters so a suffix still fits in 30."""
    base = re.sub(r"[^a-z0-9_-]", "-", hint.lower()).strip("-_")[:24]
    if len(base) < 3:
        base = "user"
    username, n = base, 1
    while username in RESERVED_USERNAMES or await users_service.username_exists(db, username):
        n += 1
        username = f"{base}{n}"
    return username


async def oauth_login(
    db: AsyncSession,
    *,
    provider: str,
    profile: OAuthProfile,
    user_agent: str | None,
    old_token: str | None,
) -> OAuthOutcome:
    """Handle a provider callback (architecture section 6: "log in first, then connect").

    While the request carries a valid session for user U (the connect flow), it owns the request:
    - the identity already belongs to U: nothing changes;
    - it belongs to another user: nothing changes (never switch accounts, never touch U's
      session), outcome `provider_in_use`;
    - U already has an identity of this provider (another provider account): nothing changes,
      outcome `provider_already_connected`;
    - U's email identity is unverified: nothing changes, outcome `verify_email_first`;
    - else the identity (provider email and its verified flag as reported) is connected to U,
      who stays signed in on the same session.
    Logged out:
    1. a known (provider, provider_user_id) logs in as its user, with a fresh session;
    2. else if any identity (any provider) already holds the same email, nothing is created,
       linked or revoked (`account_exists`): matching on email alone would let someone who
       registered another person's address take over that person's first provider login;
    3. else a new developer account is created.
    The provider's `email_verified` flag is only stored with the email; it never decides linking.
    """
    identity = await db.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == provider,
            AuthIdentity.provider_user_id == profile.provider_user_id,
        )
    )
    session = await resolve_session(db, old_token) if old_token else None
    email = normalize_email(profile.email) if profile.email else None

    if session:
        if identity:
            return OAuthOutcome(
                "unchanged" if identity.user_id == session.user_id else "provider_in_use"
            )
        has_provider = await db.scalar(
            select(AuthIdentity.id)
            .where(AuthIdentity.user_id == session.user_id, AuthIdentity.provider == provider)
            .limit(1)
        )
        if has_provider:
            return OAuthOutcome("provider_already_connected")
        unverified_email = await db.scalar(
            select(AuthIdentity.id)
            .where(
                AuthIdentity.user_id == session.user_id,
                AuthIdentity.provider == "email",
                AuthIdentity.email_verified.is_(False),
            )
            .limit(1)
        )
        if unverified_email:
            # Otherwise whoever squatted an address by signing up with it could attach their own
            # provider account, which would survive the real owner's password reset.
            return OAuthOutcome("verify_email_first")
        db.add(_new_identity(session.user_id, provider, profile, email))
        await db.commit()
        return OAuthOutcome("connected")

    if identity:
        return await _signed_in(db, identity.user_id, user_agent, old_token, "logged_in")
    if email and await db.scalar(
        select(AuthIdentity.id).where(AuthIdentity.email == email).limit(1)
    ):
        return OAuthOutcome("account_exists")
    username = await _free_username(db, profile.username_hint)
    new_user = await users_service.create_user(
        db,
        username=username,
        display_name=profile.display_name or profile.username_hint or username,
        account_type="developer",
    )
    db.add(_new_identity(new_user.id, provider, profile, email))
    return await _signed_in(db, new_user.id, user_agent, old_token, "new_account")


def _new_identity(
    user_id: int, provider: str, profile: OAuthProfile, email: str | None
) -> AuthIdentity:
    """A provider email is stored only when the provider reports it verified: an unverified
    claim must never be able to block the address's real owner (email signup, account_exists)."""
    stored = email if profile.email_verified else None
    return AuthIdentity(
        user_id=user_id,
        provider=provider,
        provider_user_id=profile.provider_user_id,
        email=stored,
        email_verified=stored is not None,
    )


async def _signed_in(
    db: AsyncSession, user_id: int, user_agent: str | None, old_token: str | None, kind: str
) -> OAuthOutcome:
    """Issue a fresh session for `user_id` (replacing the request's old one) and commit."""
    session_token = await start_session(db, user_id, user_agent, old_token)
    await db.commit()
    return OAuthOutcome(kind, session_token)
