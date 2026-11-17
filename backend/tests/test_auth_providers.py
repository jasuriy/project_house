"""GET /auth/providers lists the sign-in providers that are actually configured: a provider
appears only when its client id AND its secret are both set."""

import pytest

from app.core.config import get_settings

pytest_plugins = ["tests.auth_fixtures"]

URL = "/api/v1/auth/providers"
CREDENTIALS = (
    "google_client_id",
    "google_client_secret",
    "github_client_id",
    "github_client_secret",
)


@pytest.fixture(autouse=True)
def no_credentials(monkeypatch):
    settings = get_settings()
    for name in CREDENTIALS:
        monkeypatch.setattr(settings, name, "")


def _set(monkeypatch, **values):
    for name, value in values.items():
        monkeypatch.setattr(get_settings(), name, value)


async def test_no_credentials_lists_nothing(auth_client):
    response = await auth_client.get(URL)
    assert response.status_code == 200
    assert response.json() == {"providers": []}


async def test_github_only(auth_client, monkeypatch):
    _set(monkeypatch, github_client_id="gh-id", github_client_secret="gh-secret")
    assert (await auth_client.get(URL)).json() == {"providers": ["github"]}


async def test_both_providers_in_fixed_order(auth_client, monkeypatch):
    _set(
        monkeypatch,
        github_client_id="gh-id",
        github_client_secret="gh-secret",
        google_client_id="g-id",
        google_client_secret="g-secret",
    )
    assert (await auth_client.get(URL)).json() == {"providers": ["google", "github"]}


@pytest.mark.parametrize(
    "only",
    ["google_client_id", "google_client_secret", "github_client_id", "github_client_secret"],
)
async def test_half_configured_provider_is_not_listed(auth_client, monkeypatch, only):
    _set(monkeypatch, **{only: "value"})
    assert (await auth_client.get(URL)).json() == {"providers": []}
