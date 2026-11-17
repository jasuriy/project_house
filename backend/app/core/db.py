import asyncio
from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy import MetaData, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

DB_CHECK_TIMEOUT_SECONDS = 2

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


@lru_cache
def get_engine() -> AsyncEngine:
    """Create the engine lazily so importing the app never opens a connection."""
    return create_async_engine(get_settings().database_url, pool_pre_ping=True)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: one session per request. Services commit explicitly.

    `expire_on_commit=False` because async sessions cannot lazy-load expired attributes.
    """
    async with AsyncSession(get_engine(), expire_on_commit=False) as session:
        yield session


async def dispose_engine() -> None:
    """Close pooled connections. Does nothing if the engine was never created."""
    if get_engine.cache_info().currsize:
        await get_engine().dispose()
        get_engine.cache_clear()


async def database_is_up() -> bool:
    """Run SELECT 1 with a short timeout. Returns False on any connection failure."""
    try:
        async with asyncio.timeout(DB_CHECK_TIMEOUT_SECONDS):
            async with get_engine().connect() as conn:
                await conn.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError, TimeoutError):
        return False
    return True
