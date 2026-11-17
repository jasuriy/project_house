"""Editing one's own profile (PATCH /auth/me): the rules of the profile-page design."""

import re
from typing import Any
from urllib.parse import urlsplit

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.users.models import User
from app.users.schemas import ProfileUpdate

# Maximum length of each text field; display_name must also not be blank.
TEXT_LIMITS = {
    "display_name": 60,
    "headline": 120,
    "location": 80,
    "university_or_employer": 120,
    "company_name": 80,
    "about": 1000,
}
LINK_MAX = 200  # every link, whole URL
GITHUB_NAME = re.compile(r"[A-Za-z0-9-]{1,39}")  # GitHub's own username rule
DEVELOPER_ONLY = {"university_or_employer", "open_to_work", "links.github", "links.linkedin"}
COMPANY_ONLY = {"company_name"}


def _fail(code: str, message: str) -> AppError:
    return AppError(422, code, message)


def _text(field: str, value: str | None) -> str | None:
    """Trimmed value, or None to clear. Raises invalid_<field>."""
    value = (value or "").strip()
    if "\x00" in value or len(value) > TEXT_LIMITS[field]:
        raise _fail(f"invalid_{field}", f"{field} is too long or contains invalid characters")
    if field == "display_name" and not value:
        raise _fail("invalid_display_name", "Name must not be blank")
    return value or None


def _link_ok(key: str, url: str) -> bool:
    if len(url) > LINK_MAX:
        return False
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError:
        return False
    if parts.scheme != "https" or not parts.hostname or parts.username or parts.password:
        return False
    if key == "github":
        # Exactly https://github.com/<name>: no port, query or fragment.
        name = parts.path.strip("/")
        return (
            parts.hostname == "github.com"
            and port is None
            and not parts.query
            and not parts.fragment
            and GITHUB_NAME.fullmatch(name) is not None
        )
    if key == "linkedin":
        return parts.hostname in ("linkedin.com", "www.linkedin.com")
    return True


def _check_account_type(user: User, sent: set[str]) -> None:
    not_allowed = COMPANY_ONLY if user.account_type == "developer" else DEVELOPER_ONLY
    if sent & not_allowed:
        raise _fail("field_not_allowed", "This field does not belong to your account type")


async def update_profile(session: AsyncSession, user: User, changes: ProfileUpdate) -> User:
    """Check every sent field, then write them all and commit; any failure writes nothing."""
    sent = changes.model_dump(exclude_unset=True)
    if sent.get("open_to_work", False) is None:
        del sent["open_to_work"]  # null is not a yes/no answer: leave it as it is
    links_sent: dict[str, Any] = sent.pop("links", None) or {}
    _check_account_type(user, set(sent) | {f"links.{key}" for key in links_sent})

    values: dict[str, Any] = {}
    for field, value in sent.items():
        if field == "open_to_work":
            values[field] = bool(value)
        else:
            values[field] = _text(field, value)

    links = dict(user.links)
    for key, url in links_sent.items():
        url = (url or "").strip()
        if not url:
            links.pop(key, None)
        elif "\x00" in url or not _link_ok(key, url):
            raise _fail(f"invalid_{key}_link", f"The {key} link is not valid")
        else:
            links[key] = url

    for field, value in values.items():
        setattr(user, field, value)
    if links_sent:
        user.links = links
    await session.commit()
    return user
