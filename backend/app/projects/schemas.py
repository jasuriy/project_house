from datetime import datetime
from typing import Literal, Self

from pydantic import BaseModel

from app.projects.fields import FieldName
from app.projects.models import Project

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
    """Who made the project: the original author for demo rows, the owner for real ones."""

    kind: Literal["demo", "user"]
    name: str
    url: str


def _path(project: Project) -> str:
    if project.is_demo:
        return f"/demo/{project.slug}"
    return f"/{project.owner.username}/{project.slug}"  # type: ignore[union-attr]


def _author(project: Project) -> Author:
    if project.is_demo:
        return Author(
            kind="demo", name=project.demo_author or "", url=project.demo_author_url or ""
        )
    owner = project.owner
    return Author(kind="user", name=owner.display_name, url=f"/{owner.username}")  # type: ignore[union-attr]


class ProjectCard(BaseModel):
    slug: str
    path: str
    title: str
    one_line_problem: str
    field: FieldName
    tech_stack: list[str]
    cover: Cover | None
    author: Author
    published_at: datetime

    @classmethod
    def from_project(cls, project: Project) -> Self:
        """`project.media` and (for non-demo rows) `project.owner` must be loaded."""
        first = project.media[0] if project.media else None
        return cls(
            slug=project.slug,
            path=_path(project),
            title=project.title,
            one_line_problem=project.one_line_problem,
            field=project.field,  # type: ignore[arg-type]
            tech_stack=project.tech_stack[:CARD_TECH_STACK_LIMIT],
            cover=Cover(kind=first.kind, url=first.url) if first else None,  # type: ignore[arg-type]
            author=_author(project),
            published_at=project.published_at,
        )


class ProjectDetail(BaseModel):
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
    demo_video_url: str | None
    license: str | None
    role: str | None
    media: list[MediaItem]
    author: Author
    published_at: datetime

    @classmethod
    def from_project(cls, project: Project) -> Self:
        """`project.media` and (for non-demo rows) `project.owner` must be loaded."""
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
            demo_video_url=project.demo_video_url,
            license=project.license,
            role=project.role,
            media=[
                MediaItem(kind=m.kind, url=m.url, position=m.position, alt=m.alt)  # type: ignore[arg-type]
                for m in project.media
            ],
            author=_author(project),
            published_at=project.published_at,
        )


class FeedPage(BaseModel):
    items: list[ProjectCard]
    next_cursor: str | None
