"""Request and response shapes for accounts. Values are cleaned here (trimmed, lowercased) and
checked against the rules in the accounts spec (docs/specs/2026-11-27-accounts.md)."""

import re
import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, BeforeValidator, Field

from app.catalog import RESERVED_USERNAMES, USERNAME_PATTERN

USERNAME = re.compile(USERNAME_PATTERN)
# Only the shape: something@domain.tld. Whether the address is real is checked later (A2).
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _trim_lower(value: object) -> object:
    return value.strip().lower() if isinstance(value, str) else value


def _trim(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


def _check_username(value: str) -> str:
    if not USERNAME.match(value):
        raise ValueError(
            "use 3-30 lowercase letters, digits or hyphens, starting and ending with a letter "
            "or digit"
        )
    if value in RESERVED_USERNAMES:
        raise ValueError("this username is reserved")
    return value


def _check_email(value: str) -> str:
    if not EMAIL.match(value):
        raise ValueError("enter an email address like name@example.com")
    return value


Username = Annotated[str, BeforeValidator(_trim_lower), AfterValidator(_check_username)]
Email = Annotated[
    str, BeforeValidator(_trim_lower), Field(max_length=254), AfterValidator(_check_email)
]
DisplayName = Annotated[str, BeforeValidator(_trim), Field(min_length=1, max_length=60)]
# Not trimmed: spaces are part of a password.
Password = Annotated[str, Field(min_length=8, max_length=128)]


class SignUp(BaseModel):
    display_name: DisplayName
    username: Username
    email: Email
    password: Password


class LogIn(BaseModel):
    # Not checked against the sign-up rules: a wrong value is just a failed login.
    email: Annotated[str, BeforeValidator(_trim_lower), Field(max_length=254)]
    password: Annotated[str, Field(max_length=128)]


class Me(BaseModel):
    """The logged-in person, as their own browser sees them."""

    id: uuid.UUID
    username: str
    display_name: str
    email: str
    github_login: str | None
    avatar_url: str | None
    created_at: datetime
