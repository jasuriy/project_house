from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


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


class ProfileResponse(UserPublic):
    """The public profile page: the profile plus how many projects the user has."""

    project_count: int
