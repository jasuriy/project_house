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


def _tech_list(most: int) -> object:
    return Annotated[
        list[TechName], Field(max_length=most), AfterValidator(catalog.canonical_tech_names)
    ]


class VideoUpload(BaseModel):
    """The demo video the browser already uploaded to the temporary folder."""

    key: str = Field(max_length=300)
    file_name: str | None = Field(default=None, max_length=200)
    duration_seconds: float | None = Field(default=None, ge=0)


class ProjectCreate(BaseModel):
    """Everything on the upload page, sent once when Render is pressed.

    Required fields may arrive empty here: the service answers with the full list of what is
    missing (project_incomplete) instead of one validation error at a time.
    """

    model_config = ConfigDict(extra="forbid")

    name: _text("name") = None
    short_description: _text("short_description") = None
    project_type: Annotated[str | None, _one_of(catalog.PROJECT_TYPES)] = None
    category: Annotated[str | None, _one_of(catalog.CATEGORIES)] = None
    problem: _text("problem") = None
    outcome: _text("outcome") = None
    languages: _tech_list(catalog.MAX_LANGUAGES) = []
    tools: _tech_list(catalog.MAX_TOOLS) = []
    deliverables: _choices(catalog.DELIVERABLES) = []
    license: Annotated[str | None, _one_of(catalog.LICENSES)] = None
    status: Annotated[str | None, _one_of(catalog.STATUSES)] = None
    how_it_works: _text("how_it_works") = None
    started_on: date | None = None
    finished_on: date | None = None
    ongoing: bool = False
    video: VideoUpload | None = None
    poster_key: str | None = Field(default=None, max_length=300)
    repo_url: str | None = Field(default=None, max_length=300)


class UploadRequest(BaseModel):
    content_type: str = Field(max_length=100)
    size: int = Field(gt=0)


class UploadTicket(BaseModel):
    """Where and how the browser uploads the file: a PUT to upload_url with these headers."""

    upload_url: str
    key: str
    headers: dict[str, str]


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
    slug: str
    published_at: datetime
    name: str | None
    short_description: str | None
    project_type: str | None
    category: str | None
    problem: str | None
    outcome: str | None
    languages: list[str]
    tools: list[str]
    deliverables: list[str]
    license: str | None
    status: str | None
    how_it_works: str | None
    started_on: date | None
    finished_on: date | None
    ongoing: bool
    video: VideoOut | None
    repo_url: str | None
    repo: RepoSnapshot | None
    created_at: datetime
    updated_at: datetime


class ProjectCard(BaseModel):
    """One project in the feed: what its card shows, with a fresh signed link to the first frame."""

    slug: str
    name: str | None
    short_description: str | None
    project_type: str | None
    category: str | None
    status: str | None
    languages: list[str]
    tools: list[str]
    poster_url: str | None
    published_at: datetime


class Feed(BaseModel):
    items: list[ProjectCard]
