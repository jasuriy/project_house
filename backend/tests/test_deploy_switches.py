"""Production switches: email login off, API answers never cached, the seed override."""

import os
import subprocess
import sys

import pytest
from sqlalchemy import func, select

from app.projects.models import Project
from app.users.service import create_user
from tests.auth_helpers import signup_body
from tests.media_helpers import signup, upload
from tests.test_projects_seed import BACKEND_DIR, LOADER_MESSAGE_PRODUCTION, REAL_SEED

pytest_plugins = ["tests.auth_fixtures", "tests.media_fixtures"]

EMAIL_ROUTES = [
    ("/api/v1/auth/signup", signup_body()),
    ("/api/v1/auth/login", {"email": "bek@example.com", "password": "x" * 12}),
    ("/api/v1/auth/email/verify", {"token": "x" * 20}),
    ("/api/v1/auth/password/forgot", {"email": "bek@example.com"}),
    ("/api/v1/auth/password/reset", {"token": "x" * 20, "password": "y" * 12}),
]


@pytest.fixture
def email_off(monkeypatch, fresh_settings):
    monkeypatch.setenv("EMAIL_LOGIN_ENABLED", "false")


@pytest.mark.parametrize(("path", "body"), EMAIL_ROUTES)
async def test_email_routes_404_when_email_login_off(auth_client, email_off, path, body):
    r = await auth_client.post(path, json=body)
    assert (r.status_code, r.json()["error"]["code"]) == (404, "email_login_disabled")


async def test_providers_and_me_still_answer_when_email_login_off(auth_client, email_off):
    assert (await auth_client.get("/api/v1/auth/providers")).status_code == 200
    assert (await auth_client.get("/api/v1/auth/me")).status_code == 401


async def test_email_signup_unchanged_by_default(auth_client):
    await signup(auth_client, "alice")  # asserts 201


async def test_api_answers_are_private_no_store(auth_client):
    r = await auth_client.get("/api/v1/projects")
    assert r.headers["cache-control"] == "private, no-store"
    await signup(auth_client, "alice")
    r = await auth_client.get("/api/v1/me/saved")
    assert (r.status_code, r.headers["cache-control"]) == (200, "private, no-store")


async def test_api_errors_are_private_no_store_too(auth_client):
    r = await auth_client.get("/api/v1/me/saved")
    assert (r.status_code, r.headers["cache-control"]) == (401, "private, no-store")


async def test_media_keeps_public_cache(auth_client, media_root):
    await signup(auth_client, "alice")
    url = (await upload(auth_client)).json()["url"]
    r = await auth_client.get(url.split("http://test", 1)[-1].split("localhost:3000", 1)[-1])
    assert (r.status_code, r.headers["cache-control"]) == (
        200,
        "public, max-age=31536000, immutable",
    )


def _seed(database_url: str, *args: str) -> subprocess.CompletedProcess:
    env = os.environ | {
        "DATABASE_URL": database_url,
        "APP_ENV": "production",
        "SECRET_KEY": "s" * 40,
    }
    return subprocess.run(
        [sys.executable, "-m", "app.projects.seed_demo", *args],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


async def test_seed_allow_production_needs_owner(db_session, test_database_url):
    result = _seed(test_database_url, "--allow-production")
    assert result.returncode == 2
    assert "--allow-production needs --owner" in result.stderr
    assert await db_session.scalar(select(func.count()).select_from(Project)) == 0


async def test_seed_allow_production_with_owner_loads_the_samples(db_session, test_database_url):
    await create_user(db_session, username="jasurai", display_name="Bek", account_type="developer")
    await db_session.commit()  # the seed tool runs in its own process
    result = _seed(
        test_database_url, "--file", str(REAL_SEED), "--owner", "jasurai", "--allow-production"
    )
    assert result.returncode == 0, result.stderr
    assert LOADER_MESSAGE_PRODUCTION not in result.stderr
    assert await db_session.scalar(select(func.count()).select_from(Project)) == 29


async def test_unexpected_500_is_private_no_store_too():
    from httpx import ASGITransport, AsyncClient

    from app.main import create_app

    app = create_app()

    @app.get("/api/v1/boom")
    async def boom() -> None:
        raise RuntimeError("boom")

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.get("/api/v1/boom")
    assert (r.status_code, r.headers.get("cache-control")) == (500, "private, no-store")


def test_settings_errors_never_print_values(monkeypatch, fresh_settings):
    from pydantic import ValidationError

    from app.core.config import Settings

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "short")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "R2-SECRET-MARKER")
    with pytest.raises(ValidationError) as error:
        Settings()
    assert "R2-SECRET-MARKER" not in str(error.value)
