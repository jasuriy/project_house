"""The API contract: what each project endpoint accepts and returns."""

import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
)

from app import catalog
from app.github import RepoSnapshot


def _blank_to_none(value: object) -> object:
    """An emptied text field is stored as "no value", not as an empty string."""
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _text(limit_key: str) -> object:
    limited = Annotated[str, StringConstraints(max_length=catalog.TEXT_LIMITS[limit_key])]
    return Annotated[limited | None, BeforeValidator(_blank_to_none)]


def _one_of(options: dict[str, str]) -> AfterValidator:
    def check(value: str | None) -> str | None:
        if value is not None and value not in options:
            raise ValueError(f"must be one of: {', '.join(options)}")
        return value

    return AfterValidator(check)


def _unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))  # drop repeats, keep the order


def _choices(options: dict[str, str]) -> object:
    item = Annotated[str, _one_of(options)]
    return Annotated[list[item], AfterValidator(_unique)]


TechName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=catalog.MAX_TECH_NAME)
]
TechList = Annotated[
    list[TechName], Field(max_length=catalog.MAX_TECH_PER_FIELD), AfterValidator(_unique)
]


class ProjectUpdate(BaseModel):
    """Autosave of a draft. Only the fields that are sent change; null clears a field."""

    model_config = ConfigDict(extra="forbid")

    name: _text("name") = None
    short_description: _text("short_description") = None
    project_type: Annotated[str | None, _one_of(catalog.PROJECT_TYPES)] = None
    ai_powered: bool = False
    category: Annotated[str | None, _one_of(catalog.CATEGORIES)] = None
    post_languages: _choices(catalog.POST_LANGUAGES) = []
    problem: _text("problem") = None
    outcome: _text("outcome") = None
    audience: _text("audience") = None
    languages: TechList = []
    tools: TechList = []
    deliverables: _choices(catalog.DELIVERABLES) = []
    getting_started: _text("getting_started") = None
    requirements: _text("requirements") = None
    license: Annotated[str | None, _one_of(catalog.LICENSES)] = None
    status: Annotated[str | None, _one_of(catalog.STATUSES)] = None
    limitations: _text("limitations") = None
    how_it_works: _text("how_it_works") = None
    started_on: date | None = None
    finished_on: date | None = None
    ongoing: bool = False


class UploadRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=200)
    content_type: str = Field(max_length=100)
    size: int = Field(gt=0)


class UploadTicket(BaseModel):
    """Where and how the browser uploads the file: a PUT to upload_url with these headers."""

    upload_url: str
    key: str
    headers: dict[str, str]


class UploadComplete(BaseModel):
    key: str = Field(max_length=300)
    file_name: str | None = Field(default=None, max_length=200)
    duration_seconds: float | None = Field(default=None, ge=0)


class RepoLink(BaseModel):
    url: str = Field(max_length=300)


class VideoOut(BaseModel):
    url: str
    poster_url: str | None
    file_name: str | None
    content_type: str | None
    size: int | None
    duration_seconds: float | None


class ProjectOut(BaseModel):
    id: uuid.UUID
    slug: str | None
    published_at: datetime | None
    name: str | None
    short_description: str | None
    project_type: str | None
    ai_powered: bool
    category: str | None
    post_languages: list[str]
    problem: str | None
    outcome: str | None
    audience: str | None
    languages: list[str]
    tools: list[str]
    deliverables: list[str]
    getting_started: str | None
    requirements: str | None
    license: str | None
    status: str | None
    limitations: str | None
    how_it_works: str | None
    started_on: date | None
    finished_on: date | None
    ongoing: bool
    video: VideoOut | None
    repo_url: str | None
    repo: RepoSnapshot | None
    # Required fields that are still empty; the page's checklist and "Render" both use it.
    missing_fields: list[str]
    created_at: datetime
    updated_at: datetime
