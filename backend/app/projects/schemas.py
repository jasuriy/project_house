from datetime import datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict

from app.media import storage
from app.projects.fields import FieldName
from app.projects.models import Project, ProjectMedia
from app.projects.video import youtube_id

CARD_TECH_STACK_LIMIT = 3


class Cover(BaseModel):
    kind: Literal["image", "video"]
    url: str


class MediaItem(BaseModel):
    kind: Literal["image", "video"]
    url: str
    position: int
    alt: str | None


class Author(BaseModel):
    """Who posted the project: its owner; an ownerless sample shows its original author."""

    kind: Literal["demo", "user"]
    name: str
    url: str
    avatar_url: str | None = None


def media_url(media: ProjectMedia) -> str:
    """Stored images get their URL from the storage key; external media keep theirs."""
    return storage.url(media.storage_key) if media.storage_key else media.url or ""


def _cover(project: Project) -> Cover | None:
    """The first media item with a picture (an image, or a YouTube video's thumbnail); a
    project with neither (a Loom-only one, an mp4 sample) shows its first item."""
    if not project.media:
        return None
    pictured = (m for m in project.media if m.kind == "image" or youtube_id(media_url(m)))
    first = next(pictured, project.media[0])
    return Cover(kind=first.kind, url=media_url(first))  # type: ignore[arg-type]


def _path(project: Project) -> str:
    if project.owner_id is None:
        return f"/demo/{project.slug}"
    return f"/{project.owner.username}/{project.slug}"  # type: ignore[union-attr]


def _author(project: Project) -> Author:
    if project.owner_id is None:
        return Author(
            kind="demo", name=project.demo_author or "", url=project.demo_author_url or ""
        )
    owner = project.owner
    avatar = storage.url(owner.avatar_key) if owner.avatar_key else None  # type: ignore[union-attr]
    return Author(kind="user", name=owner.display_name, url=f"/{owner.username}", avatar_url=avatar)  # type: ignore[union-attr]


class ProjectCard(BaseModel):
    id: int
    slug: str
    path: str
    title: str
    one_line_problem: str
    field: FieldName
    tech_stack: list[str]
    cover: Cover | None
    author: Author
    published_at: datetime
    like_count: int

    @classmethod
    def from_project(cls, project: Project, *, like_count: int = 0) -> Self:
        """`project.media` and (for owned rows) `project.owner` must be loaded."""
        return cls(
            id=project.id,
            slug=project.slug,
            path=_path(project),
            title=project.title,
            one_line_problem=project.one_line_problem,
            field=project.field,  # type: ignore[arg-type]
            tech_stack=project.tech_stack[:CARD_TECH_STACK_LIMIT],
            cover=_cover(project),
            author=_author(project),
            published_at=project.published_at,
            like_count=like_count,
        )


class ProjectDetail(BaseModel):
    id: int
    slug: str
    path: str
    is_demo: bool
    title: str
    one_line_problem: str
    short_description: str
    result: str | None
    field: FieldName
    tech_stack: list[str]
    github_url: str | None
    live_url: str | None
    demo_video_url: str | None
    license: str | None
    role: str | None
    media: list[MediaItem]
    author: Author
    published_at: datetime
    like_count: int
    comment_count: int
    # For the viewer; False for a guest.
    liked: bool
    saved: bool

    @classmethod
    def from_project(
        cls,
        project: Project,
        *,
        like_count: int = 0,
        comment_count: int = 0,
        liked: bool = False,
        saved: bool = False,
    ) -> Self:
        """`project.media` and (for owned rows) `project.owner` must be loaded."""
        return cls(
            id=project.id,
            slug=project.slug,
            path=_path(project),
            is_demo=project.is_demo,
            title=project.title,
            one_line_problem=project.one_line_problem,
            short_description=project.short_description,
            result=project.result,
            field=project.field,  # type: ignore[arg-type]
            tech_stack=project.tech_stack,
            github_url=project.github_url,
            live_url=project.live_url,
            demo_video_url=project.demo_video_url,
            license=project.license,
            role=project.role,
            media=[
                MediaItem(kind=m.kind, url=media_url(m), position=m.position, alt=m.alt)  # type: ignore[arg-type]
                for m in project.media
            ],
            author=_author(project),
            published_at=project.published_at,
            like_count=like_count,
            comment_count=comment_count,
            liked=liked,
            saved=saved,
        )


class FeedPage(BaseModel):
    items: list[ProjectCard]
    next_cursor: str | None


class ImageRef(BaseModel):
    """One image of the form, in order: a new upload or an image the project already has."""

    model_config = ConfigDict(extra="forbid")

    upload: str | None = None
    media: int | None = None


class ProjectUpdate(BaseModel):
    """PATCH /me/projects/{slug}: any subset. Values are checked in app/projects/editing.py, so
    every failure has its own code; `images`, when sent, is the whole new image list."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    one_line_problem: str | None = None
    short_description: str | None = None
    result: str | None = None
    field: str | None = None
    tech_stack: list[str] | None = None
    github_url: str | None = None
    live_url: str | None = None
    role: str | None = None
    video_url: str | None = None
    images: list[ImageRef] | None = None


class ProjectInput(ProjectUpdate):
    """POST /me/projects: the required fields must be present (their values are checked later)."""

    title: str
    one_line_problem: str
    short_description: str
    field: str
    tech_stack: list[str]


class EditableImage(BaseModel):
    id: int
    url: str


class EditableProject(BaseModel):
    """GET /me/projects/{slug}: what the edit form starts from."""

    slug: str
    path: str
    is_demo: bool
    title: str
    one_line_problem: str
    short_description: str
    result: str | None
    field: FieldName
    tech_stack: list[str]
    github_url: str | None
    live_url: str | None
    role: str | None
    video_url: str | None
    license: str | None
    images: list[EditableImage]

    @classmethod
    def from_project(cls, project: Project) -> Self:
        return cls(
            slug=project.slug,
            path=_path(project),
            is_demo=project.is_demo,
            title=project.title,
            one_line_problem=project.one_line_problem,
            short_description=project.short_description,
            result=project.result,
            field=project.field,  # type: ignore[arg-type]
            tech_stack=project.tech_stack,
            github_url=project.github_url,
            live_url=project.live_url,
            role=project.role,
            video_url=project.demo_video_url,
            license=project.license,
            images=[
                EditableImage(id=m.id, url=media_url(m)) for m in project.media if m.kind == "image"
            ],
        )


class ImportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    github_url: str


class ImportPreview(BaseModel):
    """What the add form starts from after the ownership check (every value fits the form)."""

    title: str
    short_description: str
    tech_stack: list[str]
    live_url: str
    github_url: str
    license: str | None
    relation: Literal["owner", "contributor"]
    github_login: str
