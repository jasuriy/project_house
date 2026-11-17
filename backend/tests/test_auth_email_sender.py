"""The real EmailSender implementations. No test here overrides the sender dependency."""

import pytest

from app.auth.email import ConsoleEmailSender, get_email_sender
from app.core.config import get_settings
from tests.auth_helpers import signup_body


async def test_console_sender_writes_recipient_subject_and_link_to_stdout(capsys):
    await ConsoleEmailSender().send(
        "bek@example.com",
        "Verify your email",
        "Confirm:\nhttp://localhost:3000/verify-email?token=t1",
    )
    out = capsys.readouterr().out
    assert "bek@example.com" in out
    assert "Verify your email" in out
    assert "http://localhost:3000/verify-email?token=t1" in out


def test_get_email_sender_returns_the_console_sender_outside_production():
    assert isinstance(get_email_sender(), ConsoleEmailSender)


def test_get_email_sender_fails_closed_in_production(monkeypatch):
    monkeypatch.setattr(get_settings(), "app_env", "production")
    with pytest.raises(RuntimeError, match="EmailSender"):
        get_email_sender()


async def test_signup_through_the_real_sender_prints_the_verification_link(client, capsys):
    response = await client.post(
        "/api/v1/auth/signup",
        json=signup_body(),
        headers={"Origin": get_settings().public_base_url},
    )
    assert response.status_code == 201
    out = capsys.readouterr().out
    assert "bek@example.com" in out
    assert "/verify-email?token=" in out
