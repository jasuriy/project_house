"""Google and GitHub login. Authlib's real client runs (state check, token exchange, ID token
validation); only its HTTP transport is replaced by an in-process stub, so no network is used."""

import time
from collections.abc import Iterator
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from joserfc import jwt
from joserfc.jwk import RSAKey
from sqlalchemy import func, select

from app.auth import oauth as oauth_module
from app.auth.models import AuthIdentity, AuthSession
from app.auth.oauth import get_oauth_client
from app.core.config import get_settings
from app.main import app
from app.users.models import User
from tests.auth_helpers import SIGNUP, session_rows, set_cookie_header, signup_body

pytest_plugins = ["tests.auth_fixtures"]

BASE = "/api/v1/auth"
PUBLIC = "http://localhost:3000"
FAILED = f"{PUBLIC}/login?error=oauth_failed"
KEY = RSAKey.generate_key(2048, parameters={"kid": "test-key", "use": "sig"})
GOOGLE_ISSUER = "https://accounts.google.com"


class ProviderStub:
    """Plays Google's and GitHub's servers. Tests edit its fields before calling the callback."""

    def __init__(self) -> None:
        self.google = {"sub": "g-1", "email": "bek@example.com", "email_verified": True}
        self.github_user = {"id": 42, "login": "octocat", "name": "The Octocat", "email": None}
        self.github_emails = [{"email": "octo@example.com", "primary": True, "verified": True}]
        self.nonce = ""
        self.id_token_nonce: str | None = None
        self.token_status = 200
        self.github_emails_status = 200
        self.discovery_status = 200
        self.requests: list[str] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url).split("?")[0]
        self.requests.append(f"{request.method} {url}")
        if url == f"{GOOGLE_ISSUER}/.well-known/openid-configuration":
            if self.discovery_status != 200:
                return httpx.Response(self.discovery_status, json={})
            return httpx.Response(
                200,
                json={
                    "issuer": GOOGLE_ISSUER,
                    "authorization_endpoint": f"{GOOGLE_ISSUER}/o/oauth2/v2/auth",
                    "token_endpoint": "https://oauth2.googleapis.com/token",
                    "jwks_uri": "https://www.googleapis.com/oauth2/v3/certs",
                    "userinfo_endpoint": "https://openidconnect.googleapis.com/v1/userinfo",
                },
            )
        if url == "https://www.googleapis.com/oauth2/v3/certs":
            return httpx.Response(200, json={"keys": [KEY.as_dict(private=False)]})
        if url == "https://oauth2.googleapis.com/token":
            if self.token_status != 200:
                return httpx.Response(self.token_status, json={"error": "invalid_grant"})
            now = int(time.time())
            claims = {
                **self.google,
                "iss": GOOGLE_ISSUER,
                "aud": "google-client-id",
                "iat": now,
                "exp": now + 300,
                "nonce": self.id_token_nonce or self.nonce,
            }
            id_token = jwt.encode({"alg": "RS256", "kid": "test-key"}, claims, KEY)
            return httpx.Response(
                200, json={"access_token": "g-access", "token_type": "Bearer", "id_token": id_token}
            )
        if url == "https://github.com/login/oauth/access_token":
            if self.token_status != 200:
                return httpx.Response(self.token_status, json={"error": "bad_verification_code"})
            return httpx.Response(200, json={"access_token": "gh-access", "token_type": "bearer"})
        if url == "https://api.github.com/user":
            return httpx.Response(200, json=self.github_user)
        if url == "https://api.github.com/user/emails":
            if self.github_emails_status != 200:
                return httpx.Response(self.github_emails_status, json={})
            return httpx.Response(200, json=self.github_emails)
        return httpx.Response(404, json={"unexpected": url})


@pytest.fixture
def stub(auth_client, monkeypatch) -> Iterator[ProviderStub]:
    """Enable both providers and route their HTTP through the stub (set after `auth_client`,
    whose teardown clears dependency overrides)."""
    oauth_module._registry.cache_clear()  # clients (and their cached metadata) are per process
    settings = get_settings()
    monkeypatch.setattr(settings, "google_client_id", "google-client-id")
    monkeypatch.setattr(settings, "google_client_secret", "google-secret")
    monkeypatch.setattr(settings, "github_client_id", "github-client-id")
    monkeypatch.setattr(settings, "github_client_secret", "github-secret")
    provider_stub = ProviderStub()

    def client_with_stub_transport(provider: str):
        client = get_oauth_client(provider)
        client.client_kwargs["transport"] = httpx.MockTransport(provider_stub.handler)
        return client

    app.dependency_overrides[get_oauth_client] = client_with_stub_transport
    auth_client.watch.secrets |= {"google-secret", "github-secret", "g-access", "gh-access"}
    yield provider_stub
    oauth_module._registry.cache_clear()


async def _start(client, stub, provider, **headers):
    response = await client.get(f"{BASE}/oauth/{provider}/start", headers=headers)
    assert response.status_code == 302
    params = parse_qs(urlsplit(response.headers["location"]).query)
    stub.nonce = params.get("nonce", [""])[0]
    return response, params


async def _callback(client, provider, params, **query):
    query = {"code": "auth-code", "state": params["state"][0], **query}
    return await client.get(f"{BASE}/oauth/{provider}/callback", params=query)


async def _login_via(client, stub, provider):
    _, params = await _start(client, stub, provider)
    return await _callback(client, provider, params)


async def _count(db_session, model):
    return await db_session.scalar(select(func.count()).select_from(model))


# --- start ------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("provider", "host", "scope"),
    [
        ("google", "https://accounts.google.com/o/oauth2/v2/auth", "openid email profile"),
        ("github", "https://github.com/login/oauth/authorize", "read:user user:email"),
    ],
)
async def test_start_redirects_with_public_redirect_uri_whatever_the_host_header(
    auth_client, stub, provider, host, scope
):
    response, params = await _start(auth_client, stub, provider, host="backend.internal:8000")
    assert response.headers["location"].startswith(host + "?")
    assert params["redirect_uri"] == [f"{PUBLIC}/api/v1/auth/oauth/{provider}/callback"]
    assert params["scope"] == [scope]
    assert params["client_id"] == [f"{provider}-client-id"]
    assert params["response_type"] == ["code"]
    assert params["state"][0]
    assert "client_secret" not in response.headers["location"]


async def test_google_start_uses_a_nonce_and_pkce(auth_client, stub):
    _, params = await _start(auth_client, stub, "google")
    assert params["nonce"][0]
    assert params["code_challenge_method"] == ["S256"]


async def test_oauth_state_cookie_is_lax_httponly_and_short_lived(auth_client, stub):
    response, _ = await _start(auth_client, stub, "github")
    parts = [p.strip().lower() for p in set_cookie_header(response, "ph_oauth").split(";")]
    assert "httponly" in parts
    assert "samesite=lax" in parts
    assert "max-age=600" in parts
    assert "secure" not in parts
    assert not any(p.startswith("domain") for p in parts)


async def test_oauth_state_cookie_is_secure_in_production(auth_client, stub, monkeypatch):
    """SessionMiddleware reads https_only when the app is built, so check the wiring directly."""
    from app.main import create_app

    monkeypatch.setattr(get_settings(), "app_env", "production")
    options = {
        m.cls.__name__: m.kwargs for m in create_app().user_middleware if hasattr(m, "kwargs")
    }["SessionMiddleware"]
    assert options["https_only"] is True
    assert options["same_site"] == "lax"
    assert options["session_cookie"] == "ph_oauth"
    assert options["max_age"] == 600


@pytest.mark.parametrize("provider", ["google", "github", "gitlab"])
async def test_disabled_or_unknown_provider_is_404(auth_client, provider):
    start = await auth_client.get(f"{BASE}/oauth/{provider}/start")
    callback = await auth_client.get(f"{BASE}/oauth/{provider}/callback?code=x&state=y")
    for response in (start, callback):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "provider_disabled"


# --- callback: new accounts, existing identities ----------------------------------------------


async def test_google_new_identity_creates_developer_account_and_session(
    auth_client, stub, db_session
):
    response = await _login_via(auth_client, stub, "google")
    assert response.status_code == 302
    assert response.headers["location"] == f"{PUBLIC}/onboarding"

    parts = [p.strip().lower() for p in set_cookie_header(response, "ph_session").split(";")]
    assert {"httponly", "samesite=lax", "path=/", f"max-age={30 * 86400}"} <= set(parts)
    assert not any(p.startswith("domain") for p in parts)

    user = await db_session.scalar(select(User))
    assert (user.username, user.account_type) == ("bek", "developer")
    identity = await db_session.scalar(select(AuthIdentity))
    assert (identity.provider, identity.provider_user_id) == ("google", "g-1")
    assert (identity.email, identity.email_verified) == ("bek@example.com", True)
    assert len(await session_rows(db_session)) == 1

    me = await auth_client.get(f"{BASE}/me")
    assert me.status_code == 200
    assert me.json()["providers"] == ["google"]
    assert me.json()["email_verified"] is True


async def test_github_new_identity_uses_primary_verified_email_from_emails_endpoint(
    auth_client, stub, db_session
):
    stub.github_user["email"] = "public-but-unverified@example.com"
    stub.github_emails = [
        {"email": "other@example.com", "primary": False, "verified": True},
        {"email": "Octo@Example.com", "primary": True, "verified": True},
    ]
    response = await _login_via(auth_client, stub, "github")
    assert response.headers["location"] == f"{PUBLIC}/onboarding"
    identity = await db_session.scalar(select(AuthIdentity))
    assert (identity.provider, identity.provider_user_id) == ("github", "42")
    assert (identity.email, identity.email_verified) == ("octo@example.com", True)
    user = await db_session.scalar(select(User))
    assert (user.username, user.display_name) == ("octocat", "The Octocat")
    assert "GET https://api.github.com/user/emails" in stub.requests


async def test_second_login_with_same_identity_logs_in_the_same_user(auth_client, stub, db_session):
    await _login_via(auth_client, stub, "github")
    auth_client.cookies.clear()
    response = await _login_via(auth_client, stub, "github")
    assert response.headers["location"] == PUBLIC
    assert await _count(db_session, User) == 1
    assert await _count(db_session, AuthIdentity) == 1
    assert len(await session_rows(db_session)) == 2


async def test_callback_replaces_the_session_the_request_carried(auth_client, stub, db_session):
    signed_up = await auth_client.post(f"{BASE}/signup", json=signup_body())
    assert signed_up.status_code == 201
    old = auth_client.cookies.get("ph_session")
    await _login_via(auth_client, stub, "github")
    assert auth_client.cookies.get("ph_session") != old
    assert len(await session_rows(db_session)) == 1


# --- callback: linking rules ------------------------------------------------------------------


async def _signup_and_verify(client, email_sender):
    assert (await client.post(f"{BASE}/signup", json=signup_body())).status_code == 201
    token = email_sender.last_token()
    assert (await client.post(f"{BASE}/email/verify", json={"token": token})).status_code == 204
    client.cookies.clear()


async def test_verified_provider_email_links_to_account_with_verified_email(
    auth_client, stub, email_sender, db_session
):
    await _signup_and_verify(auth_client, email_sender)
    response = await _login_via(auth_client, stub, "google")
    assert response.headers["location"] == PUBLIC
    assert await _count(db_session, User) == 1
    me = await auth_client.get(f"{BASE}/me")
    assert me.json()["username"] == "bek"
    assert me.json()["providers"] == ["email", "google"]


async def test_verified_github_email_also_links(auth_client, stub, email_sender, db_session):
    await _signup_and_verify(auth_client, email_sender)
    stub.github_emails = [{"email": SIGNUP["email"], "primary": True, "verified": True}]
    await _login_via(auth_client, stub, "github")
    assert await _count(db_session, User) == 1
    assert (await auth_client.get(f"{BASE}/me")).json()["providers"] == ["email", "github"]


async def test_unverified_existing_email_is_not_linked(auth_client, stub, db_session):
    """An email signup nobody has proved they own must not capture a verified provider login."""
    assert (await auth_client.post(f"{BASE}/signup", json=signup_body())).status_code == 201
    auth_client.cookies.clear()
    response = await _login_via(auth_client, stub, "google")
    assert response.headers["location"] == f"{PUBLIC}/onboarding"
    assert await _count(db_session, User) == 2
    me = await auth_client.get(f"{BASE}/me")
    assert me.json()["providers"] == ["google"]
    assert me.json()["username"] == "bek2"  # "bek" is taken: numeric suffix


async def test_unverified_provider_email_is_not_linked(auth_client, stub, email_sender, db_session):
    await _signup_and_verify(auth_client, email_sender)
    stub.google["email_verified"] = False
    response = await _login_via(auth_client, stub, "google")
    assert response.headers["location"] == f"{PUBLIC}/onboarding"
    assert await _count(db_session, User) == 2
    assert (await auth_client.get(f"{BASE}/me")).json()["providers"] == ["google"]


async def test_github_unverified_primary_email_is_not_linked(
    auth_client, stub, email_sender, db_session
):
    await _signup_and_verify(auth_client, email_sender)
    stub.github_emails = [{"email": SIGNUP["email"], "primary": True, "verified": False}]
    await _login_via(auth_client, stub, "github")
    assert await _count(db_session, User) == 2
    me = await auth_client.get(f"{BASE}/me")
    assert me.json()["providers"] == ["github"]
    assert me.json()["email"] is None


async def test_github_without_any_verified_email_still_creates_an_account(
    auth_client, stub, db_session
):
    stub.github_emails = []
    response = await _login_via(auth_client, stub, "github")
    assert response.headers["location"] == f"{PUBLIC}/onboarding"
    assert await _count(db_session, User) == 1
    me = await auth_client.get(f"{BASE}/me")
    assert (me.json()["email"], me.json()["email_verified"]) == (None, False)


# --- callback: usernames ----------------------------------------------------------------------


async def test_username_collision_gets_a_numeric_suffix(auth_client, stub, db_session):
    assert (
        await auth_client.post(f"{BASE}/signup", json=signup_body(username="octocat"))
    ).status_code == 201
    auth_client.cookies.clear()
    await _login_via(auth_client, stub, "github")
    assert (await auth_client.get(f"{BASE}/me")).json()["username"] == "octocat2"


@pytest.mark.parametrize(
    ("login", "expected"),
    [
        ("Octo.Cat", "octo-cat"),
        ("Ab", "user"),
        ("admin", "admin2"),
        ("x" * 40, "x" * 24),
        ("---", "user"),
    ],
)
async def test_generated_usernames_follow_the_username_rules(auth_client, stub, login, expected):
    stub.github_user["login"] = login
    await _login_via(auth_client, stub, "github")
    assert (await auth_client.get(f"{BASE}/me")).json()["username"] == expected


async def test_google_username_comes_from_the_email_local_part(auth_client, stub):
    stub.google["email"] = "Aziz.Rahimov+news@Example.com"
    await _login_via(auth_client, stub, "google")
    assert (await auth_client.get(f"{BASE}/me")).json()["username"] == "aziz-rahimov-news"


# --- callback failures redirect, never 500 ----------------------------------------------------


async def _assert_failed(client, response, db_session):
    assert response.status_code == 302
    assert response.headers["location"] == FAILED  # nothing secret (code, state, token) in it
    assert "ph_session" not in response.headers.get("set-cookie", "")
    assert await _count(db_session, User) == 0
    assert await _count(db_session, AuthSession) == 0


async def test_user_cancelled_redirects_to_login_error(auth_client, stub, db_session):
    _, params = await _start(auth_client, stub, "github")
    response = await auth_client.get(
        f"{BASE}/oauth/github/callback",
        params={"error": "access_denied", "state": params["state"][0]},
    )
    await _assert_failed(auth_client, response, db_session)


async def test_state_mismatch_redirects_to_login_error(auth_client, stub, db_session):
    await _start(auth_client, stub, "github")
    response = await _callback(auth_client, "github", {"state": ["forged"]})
    await _assert_failed(auth_client, response, db_session)
    assert not any("access_token" in r for r in stub.requests)


async def test_missing_oauth_cookie_redirects_to_login_error(auth_client, stub, db_session):
    _, params = await _start(auth_client, stub, "github")
    auth_client.cookies.clear()
    response = await _callback(auth_client, "github", params)
    await _assert_failed(auth_client, response, db_session)


async def test_callback_without_any_start_redirects_to_login_error(auth_client, stub, db_session):
    response = await auth_client.get(f"{BASE}/oauth/google/callback?code=x&state=y")
    await _assert_failed(auth_client, response, db_session)


async def test_state_cannot_be_replayed(auth_client, stub, db_session):
    _, params = await _start(auth_client, stub, "github")
    assert (await _callback(auth_client, "github", params)).status_code == 302
    again = await _callback(auth_client, "github", params)
    assert again.headers["location"] == FAILED


@pytest.mark.parametrize("provider", ["google", "github"])
async def test_token_exchange_failure_redirects_to_login_error(
    auth_client, stub, db_session, provider
):
    _, params = await _start(auth_client, stub, provider)
    stub.token_status = 400
    response = await _callback(auth_client, provider, params)
    await _assert_failed(auth_client, response, db_session)


async def test_id_token_with_wrong_nonce_is_rejected(auth_client, stub, db_session):
    _, params = await _start(auth_client, stub, "google")
    stub.id_token_nonce = "someone-elses-nonce"
    await _assert_failed(auth_client, await _callback(auth_client, "google", params), db_session)


async def test_github_emails_failure_redirects_to_login_error(auth_client, stub, db_session):
    _, params = await _start(auth_client, stub, "github")
    stub.github_emails_status = 500
    await _assert_failed(auth_client, await _callback(auth_client, "github", params), db_session)


async def test_nul_bytes_in_provider_fields_are_stripped(auth_client, stub):
    stub.github_user["login"] = "octo\x00cat"
    stub.github_user["name"] = "The\x00 Octocat"
    stub.github_emails = [{"email": "octo\x00@example.com", "primary": True, "verified": True}]
    response = await _login_via(auth_client, stub, "github")
    assert response.headers["location"] == f"{PUBLIC}/onboarding"
    me = (await auth_client.get(f"{BASE}/me")).json()
    assert (me["username"], me["display_name"], me["email"]) == (
        "octocat",
        "The Octocat",
        "octo@example.com",
    )


# --- start failures and the shared client -----------------------------------------------------


async def test_start_failure_redirects_to_login_error_and_recovers(auth_client, stub):
    stub.discovery_status = 500
    failed = await auth_client.get(f"{BASE}/oauth/google/start")
    assert failed.status_code == 302
    assert failed.headers["location"] == FAILED

    stub.discovery_status = 200
    recovered = await auth_client.get(f"{BASE}/oauth/google/start")
    assert recovered.status_code == 302
    assert recovered.headers["location"].startswith("https://accounts.google.com/o/oauth2/v2/auth?")


async def test_discovery_and_jwks_are_fetched_once_across_logins(auth_client, stub):
    for _ in range(2):
        auth_client.cookies.clear()
        response = await _login_via(auth_client, stub, "google")
        assert response.status_code == 302
    discovery = "GET https://accounts.google.com/.well-known/openid-configuration"
    jwks = "GET https://www.googleapis.com/oauth2/v3/certs"
    assert stub.requests.count(discovery) == 1
    assert stub.requests.count(jwks) == 1
