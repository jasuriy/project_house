"""Email addresses and outgoing mail.

`EmailSender` is the one abstraction with a real swap: a console sender in development and
tests, a provider in production (Step 0b).
"""

import re
from typing import NamedTuple, Protocol

from app.core.config import get_settings

_EMAIL_PATTERN = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


def normalize_email(email: str) -> str:
    """The form stored and looked up everywhere: stripped and lowercased."""
    return email.strip().lower()


def check_email(email: str) -> str:
    """Pydantic validator: normalize, then reject anything not shaped like an address."""
    normalized = normalize_email(email)
    if len(normalized) > 254 or not _EMAIL_PATTERN.fullmatch(normalized):
        raise ValueError("not a valid email address")
    return normalized


class Message(NamedTuple):
    to: str
    subject: str
    body: str


class EmailSender(Protocol):
    async def send(self, to: str, subject: str, body: str) -> None: ...


class ConsoleEmailSender:
    """Prints the recipient, subject and body to stdout. The body carries a one-time link, so this
    sender is for development only. It prints instead of logging: under uvicorn's default
    logging configuration an application logger's INFO lines are not shown."""

    async def send(self, to: str, subject: str, body: str) -> None:
        print(f"Email to {to}, subject {subject!r}:\n{body}", flush=True)


def get_email_sender() -> EmailSender:
    """FastAPI dependency. Tests override it to capture messages."""
    if get_settings().app_env == "production":
        raise RuntimeError("No production EmailSender is configured (planned for Step 0b)")
    return ConsoleEmailSender()
