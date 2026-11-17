"""Code that reads settings or builds the engine itself must hit the test database."""

import os

from sqlalchemy.engine import make_url

from app.core.config import get_settings
from app.core.db import dispose_engine, get_engine

UNSET_DB_SENTINEL = "test_database_url_not_set"


def test_settings_never_point_at_dev_database_even_without_db_fixtures():
    """No DB fixture requested: the target must already be the test DB (or an unreachable
    sentinel when TEST_DATABASE_URL is unset), whatever order the tests run in."""
    expected = os.environ.get("TEST_DATABASE_URL")
    url = get_settings().database_url
    if expected:
        assert url == expected
    else:
        assert UNSET_DB_SENTINEL in url
    assert get_settings().app_env == "test"


async def test_settings_and_engine_point_at_test_database(test_database_url):
    settings = get_settings()
    assert settings.database_url == test_database_url
    assert settings.app_env == "test"
    try:
        assert get_engine().url.database == make_url(test_database_url).database
    finally:
        await dispose_engine()


async def test_fresh_settings_restores_test_url(test_database_url, fresh_settings):
    assert get_settings().database_url == os.environ["TEST_DATABASE_URL"]
    assert get_engine().url.database == make_url(test_database_url).database
    await dispose_engine()
