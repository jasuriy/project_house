import pytest

from app.core.config import Settings

AUTH_ENV = (
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "SESSION_DAYS",
)


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for name in AUTH_ENV:
        monkeypatch.delenv(name, raising=False)


def test_auth_settings_defaults_disable_providers():
    s = Settings()
    assert s.google_client_id == ""
    assert s.google_client_secret == ""
    assert s.github_client_id == ""
    assert s.github_client_secret == ""
    assert s.session_days == 30


def test_auth_settings_read_from_env(monkeypatch):
    monkeypatch.setenv("GITHUB_CLIENT_ID", "gh-id")
    monkeypatch.setenv("SESSION_DAYS", "7")
    s = Settings()
    assert s.github_client_id == "gh-id"
    assert s.session_days == 7
