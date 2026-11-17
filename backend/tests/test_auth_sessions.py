"""Signup, login, logout, /me and the session cookie."""

import hashlib
from datetime import UTC, datetime, timedelta
from typing import Annotated

import pytest
from fastapi import Depends
from sqlalchemy import delete, select, update

from app.auth import service
from app.auth.dependencies import current_user, current_user_optional
from app.auth.models import AuthIdentity, AuthSession, PasswordCredential
from app.core.config import get_settings
from app.main import app
from app.users import service as users_service
from app.users.models import User
from tests.auth_helpers import (
    PASSWORD,
    SIGNUP,
    session_rows,
    set_cookie_header,
    signup_body,
)

pytest_plugins = ["tests.auth_fixtures"]

BASE = "/api/v1/auth"


async def _signup(client, **overrides):
    return await client.post(f"{BASE}/signup", json=signup_body(**overrides))


async def _login(client, email=SIGNUP["email"], password=PASSWORD):
    return await client.post(f"{BASE}/login", json={"email": email, "password": password})


def _cookie_parts(response, name="ph_session"):
    return [p.strip().lower() for p in set_cookie_header(response, name).split(";")]


# --- signup -----------------------------------------------------------------------------------


async def test_signup_creates_account_identity_password_and_session(
    auth_client, email_sender, db_session
):
    response = await _signup(auth_client)
    assert response.status_code == 201
    body = response.json()
    assert body["username"] == "bek"
    assert body["email"] == "bek@example.com"
    assert body["email_verified"] is False
    assert body["providers"] == ["email"]
    assert "id" not in body

    identity = await db_session.scalar(select(AuthIdentity))
    assert (identity.provider, identity.provider_user_id) == ("email", "bek@example.com")
    assert identity.email_verified is False
    credential = await db_session.scalar(select(PasswordCredential))
    assert credential.password_hash.startswith("$argon2")
    assert PASSWORD not in credential.password_hash

    assert len(email_sender.messages) == 1
    assert email_sender.messages[0].to == "bek@example.com"
    assert email_sender.last_link().startswith(
        f"{get_settings().public_base_url}/verify-email?token="
    )


async def test_signup_cookie_is_httponly_lax_host_only_and_stores_only_a_hash(
    auth_client, db_session
):
    response = await _signup(auth_client)
    parts = _cookie_parts(response)
    assert "httponly" in parts
    assert "samesite=lax" in parts
    assert "path=/" in parts
    assert f"max-age={30 * 86400}" in parts
    assert not any(p.startswith("domain") for p in parts)
    assert "secure" not in parts

    token = auth_client.cookies.get("ph_session")
    rows = await session_rows(db_session)
    assert len(rows) == 1
    assert rows[0].token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert token != rows[0].token_hash
    assert rows[0].expires_at > datetime.now(UTC) + timedelta(days=29)


async def test_cookie_is_secure_in_production(auth_client, monkeypatch):
    monkeypatch.setattr(get_settings(), "app_env", "production")
    response = await _signup(auth_client)
    assert response.status_code == 201
    assert "secure" in _cookie_parts(response)


async def test_signup_normalizes_email_and_rejects_case_variants(auth_client):
    first = await _signup(auth_client, email=" Bek@Example.com ")
    assert first.status_code == 201
    assert first.json()["email"] == "bek@example.com"
    auth_client.cookies.clear()

    assert (await _login(auth_client, email="bek@example.com ")).status_code == 200
    assert (await _login(auth_client, email="BEK@EXAMPLE.COM")).status_code == 200

    dup = await _signup(auth_client, email="BEK@example.com", username="other")
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "email_taken"


async def test_signup_duplicate_username_is_409(auth_client):
    assert (await _signup(auth_client)).status_code == 201
    dup = await _signup(auth_client, email="other@example.com")
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "username_taken"


async def test_failed_signup_leaves_no_rows(auth_client, db_session):
    assert (await _signup(auth_client)).status_code == 201
    dup = await _signup(auth_client, email="bek@example.com", username="second")
    assert dup.status_code == 409
    assert len((await db_session.execute(select(User))).all()) == 1
    assert len(await session_rows(db_session)) == 1


@pytest.mark.parametrize(
    ("overrides", "code"),
    [
        ({"password": "short"}, "weak_password"),
        ({"password": "x" * 9}, "weak_password"),
        ({"username": "Bad Name"}, "invalid_username"),
        ({"username": "admin"}, "invalid_username"),
        ({"account_type": "robot"}, "invalid_account_type"),
        ({"email": "not-an-email"}, "validation_error"),
        ({"display_name": "   "}, "validation_error"),
    ],
)
async def test_signup_rejects_bad_input(auth_client, overrides, code):
    auth_client.watch.secrets.add(overrides.get("password", PASSWORD))
    response = await _signup(auth_client, **overrides)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == code


async def test_signup_company_account(auth_client):
    response = await _signup(auth_client, account_type="company")
    assert response.status_code == 201
    assert response.json()["account_type"] == "company"


# --- login ------------------------------------------------------------------------------------


async def test_login_with_correct_password(auth_client, db_session):
    await _signup(auth_client)
    auth_client.cookies.clear()
    response = await _login(auth_client)
    assert response.status_code == 200
    assert response.json()["username"] == "bek"
    assert "ph_session" in response.headers["set-cookie"]
    assert len(await session_rows(db_session)) == 2


async def test_wrong_password_and_unknown_email_give_identical_401(auth_client):
    await _signup(auth_client)
    auth_client.cookies.clear()
    wrong = await _login(auth_client, password="wrong password!!")
    unknown = await _login(auth_client, email="nobody@example.com")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert wrong.json()["error"]["code"] == "invalid_credentials"
    assert "ph_session" not in wrong.headers.get("set-cookie", "")


async def test_login_verifies_a_hash_even_for_unknown_email(auth_client, monkeypatch):
    calls = []
    real_verify = service._hasher.verify

    def spy(password, password_hash):
        calls.append(password_hash)
        return real_verify(password, password_hash)

    monkeypatch.setattr(service._hasher, "verify", spy)
    response = await _login(auth_client, email="nobody@example.com")
    assert response.status_code == 401
    assert len(calls) == 1


async def test_login_fails_for_identity_without_password(auth_client, db_session):
    await _signup(auth_client)
    await db_session.execute(delete(PasswordCredential))
    await db_session.commit()
    auth_client.cookies.clear()
    response = await _login(auth_client)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"


async def test_login_replaces_the_session_the_request_carried(auth_client, db_session):
    await _signup(auth_client)
    old = auth_client.cookies.get("ph_session")
    assert (await _login(auth_client)).status_code == 200
    new = auth_client.cookies.get("ph_session")
    assert new != old
    rows = await session_rows(db_session)
    assert [r.token_hash for r in rows] == [hashlib.sha256(new.encode()).hexdigest()]


async def test_signup_replaces_the_session_the_request_carried(auth_client, db_session):
    await _signup(auth_client)
    old = auth_client.cookies.get("ph_session")
    await _signup(auth_client, email="two@example.com", username="two")
    new = auth_client.cookies.get("ph_session")
    assert new != old
    rows = await session_rows(db_session)
    assert [r.token_hash for r in rows] == [hashlib.sha256(new.encode()).hexdigest()]


# --- /me and logout ---------------------------------------------------------------------------


async def test_me_without_cookie_is_401_json_not_a_redirect(auth_client):
    response = await auth_client.get(f"{BASE}/me")
    assert response.status_code == 401
    assert "location" not in response.headers
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Not authenticated"}
    }


async def test_me_with_session(auth_client):
    await _signup(auth_client)
    response = await auth_client.get(f"{BASE}/me")
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "bek"
    assert body["email"] == "bek@example.com"
    assert body["email_verified"] is False
    assert body["providers"] == ["email"]


async def test_me_with_unknown_cookie_is_401(auth_client):
    auth_client.cookies.set("ph_session", "not-a-real-token")
    assert (await auth_client.get(f"{BASE}/me")).status_code == 401


async def test_expired_session_is_401_and_row_removed(auth_client, db_session):
    await _signup(auth_client)
    await db_session.execute(
        update(AuthSession).values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
    )
    await db_session.commit()
    response = await auth_client.get(f"{BASE}/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"
    assert await session_rows(db_session) == []


async def test_last_seen_is_refreshed_at_most_once_per_hour(auth_client, db_session):
    await _signup(auth_client)
    recent = datetime.now(UTC) - timedelta(minutes=30)
    await db_session.execute(update(AuthSession).values(last_seen_at=recent))
    await db_session.commit()
    assert (await auth_client.get(f"{BASE}/me")).status_code == 200
    assert (await session_rows(db_session))[0].last_seen_at == recent

    stale = datetime.now(UTC) - timedelta(hours=2)
    await db_session.execute(update(AuthSession).values(last_seen_at=stale))
    await db_session.commit()
    assert (await auth_client.get(f"{BASE}/me")).status_code == 200
    refreshed = (await session_rows(db_session))[0].last_seen_at
    assert refreshed > datetime.now(UTC) - timedelta(minutes=1)


async def test_logout_deletes_row_clears_cookie_and_old_cookie_is_useless(auth_client, db_session):
    await _signup(auth_client)
    token = auth_client.cookies.get("ph_session")
    response = await auth_client.post(f"{BASE}/logout")
    assert response.status_code == 204
    assert response.content == b""
    assert await session_rows(db_session) == []

    parts = _cookie_parts(response)
    assert "max-age=0" in parts
    assert "path=/" in parts
    assert "samesite=lax" in parts
    assert "httponly" in parts

    auth_client.cookies.set("ph_session", token)
    assert (await auth_client.get(f"{BASE}/me")).status_code == 401


async def test_logout_is_204_without_or_with_invalid_session(auth_client):
    first = await auth_client.post(f"{BASE}/logout")
    assert first.status_code == 204
    assert "max-age=0" in _cookie_parts(first)
    auth_client.cookies.set("ph_session", "garbage")
    assert (await auth_client.post(f"{BASE}/logout")).status_code == 204


# --- dependencies for other features ----------------------------------------------------------


async def test_current_user_dependency_guards_a_route(auth_client):
    async def whoami(user: Annotated[User | None, Depends(current_user_optional)]) -> dict:
        return {"username": user.username if user else None}

    async def secret(user: Annotated[User, Depends(current_user)]) -> dict:
        return {"username": user.username}

    app.add_api_route("/api/v1/_test/whoami", whoami)
    app.add_api_route("/api/v1/_test/secret", secret)
    try:
        assert (await auth_client.get("/api/v1/_test/whoami")).json() == {"username": None}
        denied = await auth_client.get("/api/v1/_test/secret")
        assert denied.status_code == 401
        assert denied.json()["error"]["code"] == "not_authenticated"
        await _signup(auth_client)
        assert (await auth_client.get("/api/v1/_test/secret")).json() == {"username": "bek"}
    finally:
        app.router.routes[:] = [
            r for r in app.router.routes if not getattr(r, "path", "").startswith("/api/v1/_test")
        ]


# --- NUL bytes: PostgreSQL text cannot hold them, so they must be a 422, never a 500 ----------


@pytest.mark.parametrize("field", ["email", "password", "username", "display_name", "account_type"])
async def test_signup_with_a_nul_byte_is_422(auth_client, field):
    value = "a\x00b@example.com" if field == "email" else "ab\x00cdefghijkl"
    auth_client.watch.secrets.add(value)
    response = await _signup(auth_client, **{field: value})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


@pytest.mark.parametrize("field", ["email", "password"])
async def test_login_with_a_nul_byte_is_422(auth_client, field):
    body = {"email": SIGNUP["email"], "password": PASSWORD, field: "x\x00y"}
    response = await auth_client.post(f"{BASE}/login", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


@pytest.mark.parametrize(("provider", "verified"), [("google", True), ("github", False)])
async def test_signup_is_409_when_any_identity_already_holds_the_email(
    auth_client, db_session, provider, verified
):
    owner = await users_service.create_user(
        db_session, username="owner", display_name="Owner", account_type="developer"
    )
    db_session.add(
        AuthIdentity(
            user_id=owner.id,
            provider=provider,
            provider_user_id="p-1",
            email=SIGNUP["email"],
            email_verified=verified,
        )
    )
    await db_session.commit()
    response = await _signup(auth_client, email="BEK@example.com")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_taken"
    assert len((await db_session.execute(select(User))).all()) == 1
