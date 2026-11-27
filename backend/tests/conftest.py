"""Test setup.

- The app is pointed at the test database (and dummy R2 settings) before anything imports it.
- The test database is migrated once per run; every test starts with empty tables.
- R2 and GitHub are replaced through FastAPI dependency overrides (see tests/fakes.py).
"""

import os
import subprocess
from pathlib import Path

os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://prostagram:prostagram_dev@127.0.0.1:55433/prostagram_test",
)
for name in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"):
    os.environ[name] = "test"
os.environ["SITE_ORIGIN"] = "http://test"  # the test client's own address

from collections.abc import AsyncIterator, Iterator  # noqa: E402

import httpx  # noqa: E402
import pytest  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db import SessionFactory  # noqa: E402
from app.github import get_github  # noqa: E402
from app.main import app  # noqa: E402
from app.storage import get_storage  # noqa: E402
from tests.fakes import FakeStorage, GitHubRoutes, fake_github  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session", autouse=True)
def migrated_database() -> None:
    # Alembic runs in its own process because its env.py starts its own event loop.
    subprocess.run(["alembic", "upgrade", "head"], cwd=BACKEND_DIR, check=True, env=os.environ)


async def _truncate() -> None:
    async with SessionFactory() as session:
        await session.execute(text("TRUNCATE projects, users, sessions, login_failures"))
        await session.commit()


@pytest.fixture(autouse=True)
async def empty_tables() -> AsyncIterator[None]:
    # Before as well as after: rows left by a manual run against this database (a local browser
    # check) must not change a test's result.
    await _truncate()
    yield
    await _truncate()


@pytest.fixture
def storage() -> Iterator[FakeStorage]:
    fake = FakeStorage()
    app.dependency_overrides[get_storage] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_storage, None)


@pytest.fixture
def github_routes() -> Iterator[GitHubRoutes]:
    """Fill this dict in a test to decide what the fake GitHub answers."""
    routes: GitHubRoutes = {}
    app.dependency_overrides[get_github] = lambda: fake_github(routes)
    yield routes
    app.dependency_overrides.pop(get_github, None)


@pytest.fixture
async def client(
    storage: FakeStorage, github_routes: GitHubRoutes
) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    # Origin as a browser on the site sends it; tests of the Origin check override it.
    headers = {"Origin": "http://test"}
    async with httpx.AsyncClient(transport=transport, base_url="http://test", headers=headers) as c:
        yield c


AUTHOR = {
    "display_name": "Ada Author",
    "username": "ada",
    "email": "ada@example.com",
    "password": "ada password",
}


@pytest.fixture
async def author(client: httpx.AsyncClient) -> dict[str, str]:
    """Signs the test client up and in: its cookie jar keeps the session for the next requests."""
    response = await client.post("/api/v1/auth/signup", json=AUTHOR)
    assert response.status_code == 201, response.text
    return AUTHOR


@pytest.fixture
def reflex_readme() -> str:
    return (Path(__file__).parent / "fixtures" / "reflex_README.md").read_text(encoding="utf-8")
