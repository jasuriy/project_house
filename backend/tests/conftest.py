"""Shared fixtures. Tests run against a real PostgreSQL named by TEST_DATABASE_URL.

Once per test session the database is created if missing and migrated with
`alembic upgrade head`; after each test every table except alembic_version is truncated.
"""

import asyncio
import os
import re
import subprocess
import sys
from collections.abc import AsyncIterator, Callable, Iterator
from pathlib import Path

import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.core.db import get_engine, get_session
from app.main import app

BACKEND_DIR = Path(__file__).resolve().parents[1]
_DB_NAME = re.compile(r"[A-Za-z0-9_]+")


async def _create_database_if_missing(url: str) -> None:
    parsed = make_url(url)
    name = parsed.database or ""
    if not _DB_NAME.fullmatch(name) or "test" not in name:
        pytest.fail(
            f"TEST_DATABASE_URL database {name!r} must be [A-Za-z0-9_]+ and contain 'test': "
            "tests truncate every table",
            pytrace=False,
        )
    conn = await asyncpg.connect(
        host=parsed.host,
        port=parsed.port,
        user=parsed.username,
        password=parsed.password,
        database="postgres",
    )
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", name)
        if not exists:
            await conn.execute(f'CREATE DATABASE "{name}"')
    finally:
        await conn.close()


def _run_alembic(url: str, *args: str) -> subprocess.CompletedProcess[str]:
    """Run the Alembic CLI against `url` in a subprocess (its env.py calls asyncio.run)."""
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_DIR,
        env={**os.environ, "DATABASE_URL": url, "APP_ENV": "test"},
        capture_output=True,
        text=True,
        check=False,
    )


@pytest.fixture(scope="session")
def test_database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.fail(
            "TEST_DATABASE_URL is not set. Point it at a disposable PostgreSQL database, e.g. "
            "postgresql+asyncpg://projecthouse:projecthouse_dev@127.0.0.1:55432/projecthouse_test",
            pytrace=False,
        )
    asyncio.run(_create_database_if_missing(url))
    result = _run_alembic(url, "upgrade", "head")
    assert result.returncode == 0, f"alembic upgrade head failed:\n{result.stdout}\n{result.stderr}"
    return url


@pytest.fixture(scope="session")
def alembic_cli(test_database_url: str) -> Callable[..., subprocess.CompletedProcess[str]]:
    """Run an Alembic command against the test database: alembic_cli("downgrade", "base")."""
    return lambda *args: _run_alembic(test_database_url, *args)


async def _truncate_all(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        rows = await conn.execute(
            text(
                "SELECT tablename FROM pg_tables "
                "WHERE schemaname = 'public' AND tablename <> 'alembic_version'"
            )
        )
        tables = [f'"{name}"' for (name,) in rows]
        if tables:
            await conn.execute(text(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE"))


@pytest.fixture
async def engine(test_database_url: str) -> AsyncIterator[AsyncEngine]:
    """Per-test engine without pooling. Tables are emptied after the test.

    `db_session` and `client` depend on this fixture, so their sessions are closed (and any
    open transaction rolled back) before the TRUNCATE below runs.
    """
    engine = create_async_engine(test_database_url, poolclass=NullPool)
    yield engine
    await _truncate_all(engine)
    await engine.dispose()


@pytest.fixture
async def db_session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    async with AsyncSession(engine, expire_on_commit=False) as session:
        yield session


@pytest.fixture
async def client(engine: AsyncEngine) -> AsyncIterator[AsyncClient]:
    async def override_get_session() -> AsyncIterator[AsyncSession]:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def fresh_settings() -> Iterator[None]:
    """Rebuild settings and the engine from the current env, before and after the test."""
    get_settings.cache_clear()
    get_engine.cache_clear()
    yield
    get_settings.cache_clear()
    get_engine.cache_clear()
