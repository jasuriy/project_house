import pytest
from pydantic import ValidationError

from app.core.config import Settings

LONG_SECRET = "s" * 32
DB_URL = "postgresql+asyncpg://u:p@db:5432/x"


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for name in ("APP_ENV", "DATABASE_URL", "SECRET_KEY", "PUBLIC_BASE_URL", "CORS_ORIGINS"):
        monkeypatch.delenv(name, raising=False)


def test_development_has_defaults():
    s = Settings()
    assert s.app_env == "development"
    assert s.database_url.endswith("127.0.0.1:55432/projecthouse")
    assert s.secret_key
    assert s.public_base_url == "http://localhost:3000"
    assert s.cors_origins == ["http://localhost:3000"]


def test_production_without_database_url_raises(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", LONG_SECRET)
    with pytest.raises(ValidationError, match="DATABASE_URL"):
        Settings()


def test_production_without_secret_key_raises(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", DB_URL)
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings()


def test_production_rejects_short_secret_key(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", DB_URL)
    monkeypatch.setenv("SECRET_KEY", "too-short")
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings()


def test_production_with_both_set_is_valid(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", DB_URL)
    monkeypatch.setenv("SECRET_KEY", LONG_SECRET)
    s = Settings()
    assert (s.database_url, s.secret_key) == (DB_URL, LONG_SECRET)


def test_unknown_app_env_rejected(monkeypatch):
    monkeypatch.setenv("APP_ENV", "staging")
    with pytest.raises(ValidationError):
        Settings()
