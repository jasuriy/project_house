"""Builders for project rows, shared by the test_projects_* modules."""

from datetime import UTC, datetime
from itertools import count
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.projects.models import Project, ProjectMedia
from app.users import service as users_service

_serial = count(1)

DEFAULT_PUBLISHED_AT = datetime(2026, 11, 1, tzinfo=UTC)


def make_project(**overrides: Any) -> Project:
    """A valid demo project; override any column. Pass `media=[ProjectMedia(...)]` for media."""
    n = next(_serial)
    fields: dict[str, Any] = {
        "is_demo": True,
        "demo_author": "orig-author",
        "demo_author_url": "https://github.com/orig-author",
        "slug": f"project-{n}",
        "title": f"Project {n}",
        "one_line_problem": "A problem.",
        "short_description": "A description.",
        "field": "web",
        "tech_stack": ["Python"],
        "published_at": DEFAULT_PUBLISHED_AT,
    }
    fields.update(overrides)
    return Project(**fields)


async def add_projects(session: AsyncSession, *projects: Project) -> None:
    session.add_all(projects)
    await session.commit()


async def make_user(session: AsyncSession, username: str = "aziz", display_name: str = "Aziz R."):
    user = await users_service.create_user(
        session, username=username, display_name=display_name, account_type="developer"
    )
    await session.commit()
    return user


def media(kind: str, url: str, position: int, alt: str | None = None) -> ProjectMedia:
    return ProjectMedia(kind=kind, url=url, position=position, alt=alt)
