"""Business rules for accounts: sign up, log in, log out, and finding who a cookie belongs to.

A session is a random token in the browser's cookie; the database keeps only its SHA-256, so a
copy of the database cannot be used to log in. Functions that change data commit themselves.
"""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounts.models import LoginFailure, Session, User
from app.accounts.passwords import check_password, hash_password
from app.accounts.schemas import LogIn, SignUp
from app.errors import AppError

SESSION_LIFETIME = timedelta(days=30)
# 10 wrong passwords for one email within 15 minutes lock that email's login until the oldest of
# them is 15 minutes old (so at most 15 minutes, often less).
MAX_FAILURES = 10
FAILURE_WINDOW = timedelta(minutes=15)

# Which unique rule a sign-up broke, by the constraint's name (db.py's naming convention).
TAKEN = {
    "uq_users_username": ("username_taken", "This username is taken"),
    "uq_users_email": ("email_taken", "An account with this email already exists"),
}


def _token_hash(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


async def _start_session(session: AsyncSession, user_id: uuid.UUID) -> str:
    """Stores a new session and returns the token for the cookie. The caller commits."""
    token = secrets.token_urlsafe(32)
    session.add(
        Session(
            token_hash=_token_hash(token),
            user_id=user_id,
            expires_at=datetime.now(UTC) + SESSION_LIFETIME,
        )
    )
    return token


def _broken_constraint(exc: IntegrityError) -> str | None:
    driver_error = getattr(exc.orig, "driver_exception", None)  # asyncpg's own error
    return getattr(driver_error, "constraint_name", None)


async def sign_up(session: AsyncSession, data: SignUp) -> tuple[User, str]:
    """Creates the account and logs it in. The unique constraints decide whether the username
    and email are free, so two sign-ups at the same moment cannot both get one."""
    user = User(
        username=data.username,
        display_name=data.display_name,
        email=data.email,
        password_hash=await hash_password(data.password),
    )
    session.add(user)
    try:
        await session.flush()  # writes the user, so the session row can point to it
    except IntegrityError as exc:
        await session.rollback()
        taken = TAKEN.get(_broken_constraint(exc) or "")
        if taken is None:
            raise
        raise AppError(409, *taken) from exc
    token = await _start_session(session, user.id)
    await session.commit()
    await session.refresh(user)  # created_at is set by the database
    return user, token


async def _count_attempt(session: AsyncSession, email: str) -> LoginFailure | None:
    """Records this login attempt as a failure before the password is checked, then counts.

    Recording first is what makes the limit hold for guesses sent at the same moment: each one
    is committed before it counts, so the 11th to be recorded always sees at least 11. Returns
    the recorded row, or None (and removes it again) if the email is locked.
    """
    window_start = func.now() - FAILURE_WINDOW
    # Rows older than the window no longer count, so they are removed here.
    await session.execute(
        delete(LoginFailure).where(
            LoginFailure.email == email, LoginFailure.failed_at <= window_start
        )
    )
    attempt = LoginFailure(email=email)
    session.add(attempt)
    await session.commit()
    recent = await session.scalar(
        select(func.count())
        .select_from(LoginFailure)
        .where(LoginFailure.email == email, LoginFailure.failed_at > window_start)
    )
    if recent > MAX_FAILURES:
        # A refused attempt is not counted, so it neither grows the table nor extends the lock.
        await session.delete(attempt)
        await session.commit()
        return None
    return attempt


async def log_in(session: AsyncSession, data: LogIn) -> tuple[User, str]:
    """Checks the password. An unknown email, a wrong password and a GitHub-only account all get
    the same answer, so the answer does not tell whether an email has an account."""
    if await _count_attempt(session, data.email) is None:
        raise AppError(
            429, "too_many_attempts", "Too many failed logins. Try again in a few minutes."
        )

    user = await session.scalar(select(User).where(User.email == data.email))
    if not await check_password(user.password_hash if user else None, data.password):
        raise AppError(401, "wrong_credentials", "Wrong email or password")  # the row stays
    assert user is not None  # check_password is False without a user

    # Right password: this email's failures, its own attempt included, are cleared.
    await session.execute(delete(LoginFailure).where(LoginFailure.email == data.email))
    await session.execute(
        delete(Session).where(Session.user_id == user.id, Session.expires_at <= func.now())
    )
    token = await _start_session(session, user.id)
    await session.commit()
    return user, token


async def log_out(session: AsyncSession, token: str | None) -> None:
    """Ends the session (if there is one). Logging out twice is not an error."""
    if token:
        await session.execute(delete(Session).where(Session.token_hash == _token_hash(token)))
        await session.commit()


async def user_for_token(session: AsyncSession, token: str | None) -> User | None:
    """The user a cookie belongs to, or None if it is missing, unknown or expired."""
    if not token:
        return None
    return await session.scalar(
        select(User)
        .join(Session, Session.user_id == User.id)
        .where(Session.token_hash == _token_hash(token), Session.expires_at > func.now())
    )
