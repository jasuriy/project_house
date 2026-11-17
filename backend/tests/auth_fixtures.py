"""Fixtures for the auth tests: a capturing EmailSender, the Origin header the CSRF check
needs, and a response hook that fails a test when a secret appears in any response body."""

import re
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest

from app.auth.email import Message, get_email_sender
from app.core.config import get_settings
from app.main import app
from tests.auth_helpers import PASSWORD

_LINK = re.compile(r"https?://\S+")


def public_origin() -> str:
    return get_settings().public_base_url


@dataclass
class CapturingEmailSender:
    messages: list[Message] = field(default_factory=list)

    async def send(self, to: str, subject: str, body: str) -> None:
        self.messages.append(Message(to, subject, body))

    def last_link(self) -> str:
        return _LINK.search(self.messages[-1].body).group(0)

    def last_token(self) -> str:
        return parse_qs(urlsplit(self.last_link()).query)["token"][0]


@dataclass
class SecretWatch:
    """Strings that must never appear in a response body: passwords registered by the test,
    every emailed token, and every session cookie value the client has held."""

    sender: CapturingEmailSender
    client: httpx.AsyncClient
    secrets: set[str] = field(default_factory=lambda: {PASSWORD})
    seen_cookie_values: set[str] = field(default_factory=set)

    def current(self) -> set[str]:
        found = set(self.secrets) | self.seen_cookie_values
        for message in self.sender.messages:
            found |= {
                v
                for values in parse_qs(urlsplit(_LINK.search(message.body).group(0)).query).values()
                for v in values
            }
        return found

    async def check(self, response: httpx.Response) -> None:
        await response.aread()
        for header in response.headers.get_list("set-cookie"):
            name, _, value = header.split(";", 1)[0].partition("=")
            if name == "ph_session" and value.strip('"'):
                self.seen_cookie_values.add(value.strip('"'))
        for secret in self.current():
            assert secret not in response.text, "a secret appeared in a response body"


@pytest.fixture
def email_sender(client: httpx.AsyncClient) -> CapturingEmailSender:
    """Depends on `client`: its teardown clears overrides, so this one is set after it."""
    sender = CapturingEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: sender
    return sender


@pytest.fixture
async def auth_client(
    client: httpx.AsyncClient, email_sender: CapturingEmailSender
) -> AsyncIterator[httpx.AsyncClient]:
    """`client` that sends the public Origin and checks every response body for leaked secrets.
    Tests that need no Origin header pop it from `auth_client.headers`."""
    client.headers["Origin"] = public_origin()
    watch = SecretWatch(email_sender, client)
    client.event_hooks["response"].append(watch.check)
    client.watch = watch  # type: ignore[attr-defined]
    yield client
