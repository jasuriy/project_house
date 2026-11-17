"""Email verification and password reset."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update

from app.auth.models import EmailToken
from tests.auth_helpers import (
    PASSWORD,
    SIGNUP,
    session_rows,
    signup_body,
)

pytest_plugins = ["tests.auth_fixtures"]

BASE = "/api/v1/auth"
NEW_PASSWORD = "a brand new passphrase"


async def _signup(client, **overrides):
    return await client.post(f"{BASE}/signup", json=signup_body(**overrides))


async def _login(client, password):
    return await client.post(f"{BASE}/login", json={"email": SIGNUP["email"], "password": password})


async def _forgot(client, email=SIGNUP["email"]):
    return await client.post(f"{BASE}/password/forgot", json={"email": email})


async def _expire_all_tokens(db_session):
    await db_session.execute(
        update(EmailToken).values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
    )
    await db_session.commit()


# --- verification -----------------------------------------------------------------------------


async def test_verify_token_works_once(auth_client, email_sender):
    await _signup(auth_client)
    token = email_sender.last_token()
    assert (await auth_client.get(f"{BASE}/me")).json()["email_verified"] is False

    first = await auth_client.post(f"{BASE}/email/verify", json={"token": token})
    assert first.status_code == 204
    assert (await auth_client.get(f"{BASE}/me")).json()["email_verified"] is True

    second = await auth_client.post(f"{BASE}/email/verify", json={"token": token})
    assert second.status_code == 400
    assert second.json()["error"]["code"] == "token_invalid"


async def test_expired_verify_token_is_400_and_does_not_verify(
    auth_client, email_sender, db_session
):
    await _signup(auth_client)
    token = email_sender.last_token()
    await _expire_all_tokens(db_session)
    response = await auth_client.post(f"{BASE}/email/verify", json={"token": token})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "token_invalid"
    assert (await auth_client.get(f"{BASE}/me")).json()["email_verified"] is False


async def test_unknown_verify_token_is_400(auth_client):
    response = await auth_client.post(f"{BASE}/email/verify", json={"token": "nope"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "token_invalid"


async def test_tokens_are_stored_hashed(auth_client, email_sender, db_session):
    await _signup(auth_client)
    token = email_sender.last_token()
    row = await db_session.scalar(select(EmailToken))
    assert row.token_hash != token
    assert len(row.token_hash) == 64


async def test_a_reset_token_cannot_verify_an_email(auth_client, email_sender):
    await _signup(auth_client)
    await _forgot(auth_client)
    reset_token = email_sender.last_token()
    response = await auth_client.post(f"{BASE}/email/verify", json={"token": reset_token})
    assert response.status_code == 400


async def test_a_verify_token_cannot_reset_a_password(auth_client, email_sender):
    await _signup(auth_client)
    verify_token = email_sender.last_token()
    response = await auth_client.post(
        f"{BASE}/password/reset", json={"token": verify_token, "new_password": NEW_PASSWORD}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "token_invalid"


# --- forgot and reset -------------------------------------------------------------------------


async def test_forgot_for_unknown_email_is_202_and_sends_nothing(auth_client, email_sender):
    response = await _forgot(auth_client, "nobody@example.com")
    assert response.status_code == 202
    assert email_sender.messages == []


async def test_forgot_for_known_email_sends_one_message_to_the_frontend(auth_client, email_sender):
    await _signup(auth_client)
    before = len(email_sender.messages)
    response = await _forgot(auth_client, " Bek@Example.com ")
    assert response.status_code == 202
    assert len(email_sender.messages) == before + 1
    message = email_sender.messages[-1]
    assert message.to == "bek@example.com"
    assert email_sender.last_link().startswith("http://localhost:3000/reset-password?token=")


async def test_forgot_responses_are_identical_for_known_and_unknown(auth_client):
    await _signup(auth_client)
    known = await _forgot(auth_client)
    unknown = await _forgot(auth_client, "nobody@example.com")
    assert (known.status_code, known.content) == (unknown.status_code, unknown.content)


async def test_reset_changes_password_and_removes_only_that_users_sessions(
    auth_client, email_sender, db_session
):
    other = await _signup(auth_client, email="two@example.com", username="two")
    assert other.status_code == 201
    auth_client.cookies.clear()
    await _signup(auth_client)  # bek, first device
    auth_client.cookies.clear()
    await _login(auth_client, PASSWORD)  # bek, second device
    assert len(await session_rows(db_session)) == 3

    await _forgot(auth_client)
    auth_client.watch.secrets.add(NEW_PASSWORD)
    response = await auth_client.post(
        f"{BASE}/password/reset",
        json={"token": email_sender.last_token(), "new_password": NEW_PASSWORD},
    )
    assert response.status_code == 204
    assert "set-cookie" not in response.headers

    assert len(await session_rows(db_session)) == 1  # only "two" keeps a session
    assert (await _login(auth_client, PASSWORD)).status_code == 401
    assert (await _login(auth_client, NEW_PASSWORD)).status_code == 200


async def test_reset_token_is_single_use(auth_client, email_sender):
    await _signup(auth_client)
    await _forgot(auth_client)
    token = email_sender.last_token()
    body = {"token": token, "new_password": NEW_PASSWORD}
    assert (await auth_client.post(f"{BASE}/password/reset", json=body)).status_code == 204
    again = await auth_client.post(f"{BASE}/password/reset", json=body)
    assert again.status_code == 400
    assert again.json()["error"]["code"] == "token_invalid"


async def test_expired_reset_token_is_400(auth_client, email_sender, db_session):
    await _signup(auth_client)
    await _forgot(auth_client)
    token = email_sender.last_token()
    await _expire_all_tokens(db_session)
    response = await auth_client.post(
        f"{BASE}/password/reset", json={"token": token, "new_password": NEW_PASSWORD}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "token_invalid"
    assert (await _login(auth_client, PASSWORD)).status_code == 200


async def test_weak_new_password_is_422_and_keeps_the_token_usable(auth_client, email_sender):
    await _signup(auth_client)
    await _forgot(auth_client)
    token = email_sender.last_token()
    auth_client.watch.secrets.add("short")
    weak = await auth_client.post(
        f"{BASE}/password/reset", json={"token": token, "new_password": "short"}
    )
    assert weak.status_code == 422
    assert weak.json()["error"]["code"] == "weak_password"
    ok = await auth_client.post(
        f"{BASE}/password/reset", json={"token": token, "new_password": NEW_PASSWORD}
    )
    assert ok.status_code == 204


async def test_a_successful_reset_voids_the_users_other_unused_reset_tokens(
    auth_client, email_sender
):
    await _signup(auth_client)
    await _forgot(auth_client)
    older = email_sender.last_token()
    await _forgot(auth_client)
    newer = email_sender.last_token()
    assert older != newer

    ok = await auth_client.post(
        f"{BASE}/password/reset", json={"token": newer, "new_password": NEW_PASSWORD}
    )
    assert ok.status_code == 204
    stale = await auth_client.post(
        f"{BASE}/password/reset", json={"token": older, "new_password": "another passphrase"}
    )
    assert stale.status_code == 400
    assert stale.json()["error"]["code"] == "token_invalid"
    assert (await _login(auth_client, NEW_PASSWORD)).status_code == 200


async def test_a_reset_does_not_void_the_verify_token(auth_client, email_sender):
    await _signup(auth_client)
    verify_token = email_sender.last_token()
    await _forgot(auth_client)
    await auth_client.post(
        f"{BASE}/password/reset",
        json={"token": email_sender.last_token(), "new_password": NEW_PASSWORD},
    )
    response = await auth_client.post(f"{BASE}/email/verify", json={"token": verify_token})
    assert response.status_code == 204
