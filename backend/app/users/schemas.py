from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

from app.media import storage
from app.users.models import User


class UserPublic(BaseModel):
    """Public profile. The numeric id is deliberately not exposed (URLs use usernames)."""

    model_config = ConfigDict(from_attributes=True)

    username: str
    display_name: str
    account_type: Literal["developer", "company"]
    headline: str | None
    location: str | None
    university_or_employer: str | None
    company_name: str | None
    about: str | None
    open_to_work: bool
    is_verified_company: bool
    avatar_url: str | None
    links: dict[str, Any]
    created_at: datetime

    @classmethod
    def of(cls, user: User) -> "UserPublic":
        """The public profile; `avatar_url` is the uploaded photo when there is one."""
        profile = cls.model_validate(user)
        if user.avatar_key:
            profile.avatar_url = storage.url(user.avatar_key)
        return profile


class ProfileResponse(UserPublic):
    """The public profile page: the profile plus how many projects the user has."""

    project_count: int


class LinksUpdate(BaseModel):
    """Profile links to change: an absent key stays, an empty string removes the link."""

    model_config = ConfigDict(extra="forbid")

    github: str | None = None
    linkedin: str | None = None
    website: str | None = None


class ProfileUpdate(BaseModel):
    """PATCH /auth/me: any subset of the editable fields. Values are checked in the service, so each
    failure gets its own error code (the form shows it next to the field)."""

    model_config = ConfigDict(extra="forbid")

    display_name: str | None = None
    headline: str | None = None
    location: str | None = None
    university_or_employer: str | None = None
    company_name: str | None = None
    open_to_work: bool | None = None
    about: str | None = None
    links: LinksUpdate | None = None
