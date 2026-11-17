import asyncio
from functools import lru_cache

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.config import get_settings

DB_CHECK_TIMEOUT_SECONDS = 2


@lru_cache
def get_engine() -> AsyncEngine:
    """Create the engine lazily so importing the app never opens a connection."""
    return create_async_engine(get_settings().database_url)


async def database_is_up() -> bool:
    """Run SELECT 1 with a short timeout. Returns False on any connection failure."""
    try:
        async with asyncio.timeout(DB_CHECK_TIMEOUT_SECONDS):
            async with get_engine().connect() as conn:
                await conn.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError, TimeoutError):
        return False
    return True
