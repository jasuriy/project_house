import os

import pytest

from app.core.db import database_is_up
from app.main import app


async def test_health_ok_when_database_up(client):
    app.dependency_overrides[database_is_up] = lambda: True
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "database": "ok"}


async def test_health_503_when_database_down(client):
    app.dependency_overrides[database_is_up] = lambda: False
    r = await client.get("/api/health")
    assert r.status_code == 503
    assert r.json() == {"status": "degraded", "database": "unreachable"}


async def test_database_is_up_false_for_unreachable_host(monkeypatch, fresh_settings):
    # Port 1 on 127.0.0.1: nothing listens there. On Windows the refusal takes ~2 s, so
    # database_is_up returns False via its 2 s timeout; on Linux it is refused in ms (OSError).
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@127.0.0.1:1/x")
    assert await database_is_up() is False


@pytest.mark.skipif(not os.getenv("DATABASE_URL"), reason="needs a real Postgres")
async def test_database_is_up_true_with_real_database(fresh_settings):
    # Runs in CI (Postgres service) and locally when DATABASE_URL points at the compose db.
    assert await database_is_up() is True
