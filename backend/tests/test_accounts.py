"""Sign up, log in, log out, the login cookie, the login limit, and the Origin check."""

import asyncio
from collections.abc import Iterator

import httpx
import pytest
from sqlalchemy import select, text

from app.accounts.models import Session, User
from app.config import get_settings
from app.db import SessionFactory

ALICE = {
    "display_name": "  Alice Karimova ",
    "username": "Alice-K",
    "email": " Alice@Example.com ",
    "password": "correct horse",
}


async def sign_up(client: httpx.AsyncClient, **changes: str) -> httpx.Response:
    return await client.post("/api/v1/auth/signup", json={**ALICE, **changes})


async def log_in(client: httpx.AsyncClient, email: str, password: str) -> httpx.Response:
    return await client.post("/api/v1/auth/login", json={"email": email, "password": password})


@pytest.fixture(autouse=True)
def no_cookie_jar(client: httpx.AsyncClient) -> None:
    """The client would keep cookies and send them on its own; every test here sends the cookie
    it means explicitly (as_user), so nothing passes on a cookie it did not choose. The client
    stores a response's cookies before its response hooks run, so this hook forgets them."""

    async def forget_cookies(_: httpx.Response) -> None:
        client.cookies.clear()

    client.event_hooks["response"].append(forget_cookies)


def session_cookie(response: httpx.Response) -> str:
    """The token in the response's Set-Cookie."""
    cookie = response.headers["set-cookie"].split(";")[0]
    name, _, token = cookie.partition("=")
    assert name == "ph_session"
    return token


def as_user(token: str) -> dict[str, str]:
    return {"Cookie": f"ph_session={token}"}


# --- sign up ------------------------------------------------------------------------------------


async def test_sign_up_creates_the_account_and_logs_in(client: httpx.AsyncClient) -> None:
    response = await sign_up(client)

    assert response.status_code == 201
    body = response.json()
    assert body["username"] == "alice-k"  # lowercased
    assert body["email"] == "alice@example.com"  # trimmed and lowercased
    assert body["display_name"] == "Alice Karimova"  # trimmed
    assert body["github_login"] is None and body["avatar_url"] is None
    assert "password" not in str(body) and "hash" not in str(body)

    assert (await client.get("/api/v1/auth/me")).status_code == 401  # no cookie sent by itself
    me = await client.get("/api/v1/auth/me", headers=as_user(session_cookie(response)))
    assert me.status_code == 200
    assert me.json()["username"] == "alice-k"


async def test_only_hashes_are_stored(client: httpx.AsyncClient) -> None:
    response = await sign_up(client)
    token = session_cookie(response)

    async with SessionFactory() as db:
        user = await db.scalar(select(User))
        stored = await db.scalar(select(Session))
    assert user is not None and stored is not None
    assert user.password_hash is not None and user.password_hash.startswith("$argon2id$")
    assert "correct horse" not in user.password_hash
    assert stored.token_hash != token.encode() and len(stored.token_hash) == 32  # SHA-256


@pytest.mark.parametrize(
    ("changes", "code"),
    [
        ({"username": "alice-k", "email": "other@example.com"}, "username_taken"),
        ({"username": "ALICE-K", "email": "other@example.com"}, "username_taken"),
        ({"username": "someone-else", "email": "ALICE@example.com"}, "email_taken"),
    ],
)
async def test_a_taken_username_or_email_is_refused(
    client: httpx.AsyncClient, changes: dict[str, str], code: str
) -> None:
    assert (await sign_up(client)).status_code == 201

    response = await sign_up(client, **changes)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == code


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"username": "ab"}, "username"),
        ({"username": "a" * 31}, "username"),
        ({"username": "-alice"}, "username"),
        ({"username": "alice-"}, "username"),
        ({"username": "alice_k"}, "username"),
        ({"username": "login"}, "username"),  # reserved
        ({"email": "alice.example.com"}, "email"),
        ({"email": "alice@example"}, "email"),
        ({"display_name": "   "}, "display_name"),
        ({"display_name": "x" * 61}, "display_name"),
        ({"password": "1234567"}, "password"),
        ({"password": "x" * 129}, "password"),
    ],
)
async def test_sign_up_checks_every_field(
    client: httpx.AsyncClient, changes: dict[str, str], field: str
) -> None:
    response = await sign_up(client, **changes)

    assert response.status_code == 422
    assert response.json()["error"]["message"].startswith(f"{field}:")


async def test_the_longest_allowed_values_are_accepted(client: httpx.AsyncClient) -> None:
    response = await sign_up(client, username="a" * 30, display_name="x" * 60, password="p" * 128)
    assert response.status_code == 201


# --- log in and log out -------------------------------------------------------------------------


async def test_log_in_with_any_case_of_the_email(client: httpx.AsyncClient) -> None:
    await sign_up(client)

    response = await log_in(client, "  ALICE@example.COM", "correct horse")

    assert response.status_code == 200
    assert response.json()["username"] == "alice-k"
    me = await client.get("/api/v1/auth/me", headers=as_user(session_cookie(response)))
    assert me.status_code == 200


@pytest.mark.parametrize(
    ("email", "password"),
    [("alice@example.com", "wrong password"), ("nobody@example.com", "correct horse")],
)
async def test_a_failed_login_does_not_say_why(
    client: httpx.AsyncClient, email: str, password: str
) -> None:
    await sign_up(client)

    response = await log_in(client, email, password)

    assert response.status_code == 401
    assert response.json()["error"] == {
        "code": "wrong_credentials",
        "message": "Wrong email or password",
    }
    assert "set-cookie" not in response.headers


async def test_an_account_without_a_password_cannot_log_in_with_one(
    client: httpx.AsyncClient,
) -> None:
    await sign_up(client)
    async with SessionFactory() as db:  # as a GitHub-only account will be
        await db.execute(text("UPDATE users SET password_hash = NULL"))
        await db.commit()

    response = await log_in(client, "alice@example.com", "correct horse")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "wrong_credentials"


async def test_ten_failed_logins_lock_the_email(client: httpx.AsyncClient) -> None:
    await sign_up(client)
    for _ in range(10):
        assert (await log_in(client, "alice@example.com", "wrong password")).status_code == 401

    # The 11th attempt is refused even with the right password.
    response = await log_in(client, "alice@example.com", "correct horse")
    assert response.status_code == 429
    assert response.json()["error"] == {
        "code": "too_many_attempts",
        "message": "Too many failed logins. Try again in a few minutes.",
    }

    # Failures older than 15 minutes no longer count.
    async with SessionFactory() as db:
        await db.execute(text("UPDATE login_failures SET failed_at = now() - interval '16 min'"))
        await db.commit()
    assert (await log_in(client, "alice@example.com", "correct horse")).status_code == 200


async def test_parallel_guesses_cannot_pass_the_limit(client: httpx.AsyncClient) -> None:
    """Guesses sent at the same moment must not all be checked before any of them is counted."""
    await sign_up(client)

    responses = await asyncio.gather(
        *(log_in(client, "alice@example.com", f"wrong {i}") for i in range(12))
    )

    codes = sorted(r.status_code for r in responses)
    assert codes.count(401) <= 10
    assert codes.count(401) + codes.count(429) == 12


async def test_a_successful_login_resets_the_count(client: httpx.AsyncClient) -> None:
    await sign_up(client)
    for _ in range(9):
        await log_in(client, "alice@example.com", "wrong password")
    assert (await log_in(client, "alice@example.com", "correct horse")).status_code == 200

    for _ in range(9):
        await log_in(client, "alice@example.com", "wrong password")
    assert (await log_in(client, "alice@example.com", "correct horse")).status_code == 200


async def test_log_out_ends_the_session(client: httpx.AsyncClient) -> None:
    token = session_cookie(await sign_up(client))
    cookies = as_user(token)

    response = await client.post("/api/v1/auth/logout", headers=cookies)

    assert response.status_code == 204
    assert 'ph_session=""' in response.headers["set-cookie"]
    assert "Max-Age=0" in response.headers["set-cookie"]
    assert (await client.get("/api/v1/auth/me", headers=cookies)).status_code == 401
    # Logging out again, or without a cookie, is fine.
    assert (await client.post("/api/v1/auth/logout", headers=cookies)).status_code == 204
    assert (await client.post("/api/v1/auth/logout")).status_code == 204


@pytest.mark.parametrize("cookie", [None, "made-up-token"])
async def test_me_without_a_valid_session_is_401(
    client: httpx.AsyncClient, cookie: str | None
) -> None:
    response = await client.get("/api/v1/auth/me", headers=as_user(cookie) if cookie else None)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_logged_in"


async def test_an_expired_session_is_401(client: httpx.AsyncClient) -> None:
    cookies = as_user(session_cookie(await sign_up(client)))
    async with SessionFactory() as db:
        await db.execute(text("UPDATE sessions SET expires_at = now() - interval '1 second'"))
        await db.commit()

    assert (await client.get("/api/v1/auth/me", headers=cookies)).status_code == 401


# --- the cookie ---------------------------------------------------------------------------------


@pytest.fixture
def https_site(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """The site as in production: https, so the cookie must be Secure."""
    monkeypatch.setenv("SITE_ORIGIN", "https://site.test")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()  # monkeypatch restores SITE_ORIGIN after this


async def test_the_cookie_rules_in_production(client: httpx.AsyncClient, https_site: None) -> None:
    response = await client.post(
        "/api/v1/auth/signup", json=ALICE, headers={"Origin": "https://site.test"}
    )

    assert response.status_code == 201
    parts = [p.strip() for p in response.headers["set-cookie"].split(";")]
    assert parts[0].startswith("ph_session=") and len(parts[0]) > len("ph_session=") + 40
    assert set(parts[1:]) == {
        "HttpOnly",
        "Max-Age=2592000",  # 30 days
        "Path=/",
        "SameSite=lax",
        "Secure",
    }


async def test_the_cookie_is_not_secure_on_a_local_http_site(client: httpx.AsyncClient) -> None:
    response = await sign_up(client)
    assert "Secure" not in response.headers["set-cookie"]


# --- the Origin check ---------------------------------------------------------------------------


@pytest.mark.parametrize("origin", [None, "https://evil.example", "http://test.evil.example"])
@pytest.mark.parametrize(
    "path",
    ["/api/v1/auth/signup", "/api/v1/auth/login", "/api/v1/auth/logout", "/api/v1/projects"],
)
async def test_changes_from_another_site_are_refused(
    client: httpx.AsyncClient, origin: str | None, path: str
) -> None:
    headers = {"Origin": origin} if origin else {}
    if origin is None:
        client.headers.pop("Origin")

    response = await client.post(path, json={}, headers=headers)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "origin_not_allowed"
    assert response.headers["cache-control"] == "no-store"


async def test_reading_needs_no_origin(client: httpx.AsyncClient) -> None:
    client.headers.pop("Origin")
    assert (await client.get("/api/v1/projects")).status_code == 200
