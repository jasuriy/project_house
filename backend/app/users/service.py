from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.projects.models import Project
from app.users.models import ACCOUNT_TYPES, User
from app.users.usernames import validate_username

USERNAME_UNIQUE_CONSTRAINT = "uq_users_username"


def _violated_constraint(exc: IntegrityError) -> str | None:
    """Constraint name from the driver error. With asyncpg it sits on `exc.orig.__cause__`."""
    driver_error = exc.orig
    for candidate in (driver_error, getattr(driver_error, "__cause__", None)):
        name = getattr(candidate, "constraint_name", None)
        if name:
            return name
    return None


async def get_by_id(session: AsyncSession, user_id: int) -> User | None:
    return await session.get(User, user_id)


async def get_by_username(session: AsyncSession, username: str) -> User | None:
    return await session.scalar(select(User).where(User.username == username))


async def count_projects(session: AsyncSession, user_id: int) -> int:
    count = await session.scalar(select(func.count()).where(Project.owner_id == user_id))
    return count or 0


async def username_exists(session: AsyncSession, username: str) -> bool:
    found = await session.scalar(select(User.id).where(User.username == username))
    return found is not None


async def create_user(
    session: AsyncSession, *, username: str, display_name: str, account_type: str
) -> User:
    """Insert a user and flush; the caller commits, so signup can add its own rows first.

    The insert runs in a savepoint: a duplicate username (also under a concurrent signup)
    becomes AppError 409 without aborting the caller's transaction. Any other integrity
    error is re-raised unchanged.
    """
    validate_username(username)
    if account_type not in ACCOUNT_TYPES:
        raise AppError(422, "invalid_account_type", "Account type must be developer or company")
    user = User(username=username, display_name=display_name, account_type=account_type)
    try:
        async with session.begin_nested():
            session.add(user)
            await session.flush()
    except IntegrityError as exc:
        if _violated_constraint(exc) != USERNAME_UNIQUE_CONSTRAINT:
            raise
        raise AppError(409, "username_taken", "This username is already taken") from exc
    return user
