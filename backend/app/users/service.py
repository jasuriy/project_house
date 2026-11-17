from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.users.models import ACCOUNT_TYPES, User
from app.users.usernames import validate_username


async def get_by_id(session: AsyncSession, user_id: int) -> User | None:
    return await session.get(User, user_id)


async def get_by_username(session: AsyncSession, username: str) -> User | None:
    return await session.scalar(select(User).where(User.username == username))


async def username_exists(session: AsyncSession, username: str) -> bool:
    found = await session.scalar(select(User.id).where(User.username == username))
    return found is not None


async def create_user(
    session: AsyncSession, *, username: str, display_name: str, account_type: str
) -> User:
    """Insert a user and flush; the caller commits, so signup can add its own rows first.

    The insert runs in a savepoint: a duplicate username (also under a concurrent signup)
    becomes AppError 409 without aborting the caller's transaction.
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
        raise AppError(409, "username_taken", "This username is already taken") from exc
    return user
