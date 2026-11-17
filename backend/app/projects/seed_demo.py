"""Load the temporary demo projects (seed/demo-projects.json) into the database.

    python -m app.projects.seed_demo [--file PATH] [--delete]

Idempotent: demo rows are upserted by slug, and a demo project's media is replaced with the
entry's current media. `--delete` removes every demo row (media cascade in the database).
Refuses to run when APP_ENV=production (exit code 2), before any database access.
"""

import argparse
import asyncio
import json
import re
import sys
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.db import dispose_engine, get_engine
from app.projects.fields import FIELDS
from app.projects.models import Project, ProjectMedia

# This file is <repo>/backend/app/projects/seed_demo.py: never resolved from the working directory.
DEFAULT_SEED_FILE = Path(__file__).resolve().parents[3] / "seed" / "demo-projects.json"

VIDEO_HOSTS = ("youtube.com", "youtu.be", "loom.com", "vimeo.com")
EXIT_REFUSED = 2


def slugify(title: str) -> str:
    """Lowercase; every run of characters outside [a-z0-9] becomes one '-'; trimmed."""
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    if not slug:
        raise ValueError(f"title {title!r} has no characters usable in a slug")
    return slug


def media_kind(url: str) -> str:
    """'video' for known video hosts and .mp4 files, 'image' for .gif; anything else is an error."""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    path = parsed.path.lower()
    if any(host == h or host.endswith("." + h) for h in VIDEO_HOSTS) or path.endswith(".mp4"):
        return "video"
    if path.endswith(".gif"):
        return "image"
    raise ValueError(f"not a recognised video or gif URL: {url}")


def _owner_url(repo_url: str) -> str:
    owner = urlparse(repo_url).path.strip("/").split("/")[0]
    return f"https://github.com/{owner}"


def project_values(entry: dict[str, Any]) -> dict[str, Any]:
    """Project columns for one seed entry. Pure: no database access."""
    title = entry["title"]
    if entry["field"] not in FIELDS:
        raise ValueError(f"{title}: unknown field {entry['field']!r}")
    return {
        "is_demo": True,
        "owner_id": None,
        "slug": slugify(title),
        "title": title,
        "one_line_problem": entry["one_line_problem"],
        "short_description": entry["short_description"],
        "result": entry["result"],
        "field": entry["field"],
        "tech_stack": list(entry["tech_stack"]),
        "github_url": entry["repo_url"],
        "demo_video_url": entry["demo_video_url"],
        "license": entry["license"],
        "role": None,
        "demo_author": entry["original_author"],
        "demo_author_url": _owner_url(entry["repo_url"]),
        "published_at": datetime.fromisoformat(entry["pushed_at"]).replace(tzinfo=UTC),
    }


def media_rows(entry: dict[str, Any]) -> list[ProjectMedia]:
    """The demo video (if any) at position 0, then the images in file order."""
    items: list[tuple[str, str]] = []
    if entry["demo_video_url"]:
        items.append((media_kind(entry["demo_video_url"]), entry["demo_video_url"]))
    # Entries under image_urls are screenshots: always images, so only the video URL is classified.
    items.extend(("image", url) for url in entry["image_urls"])
    return [
        ProjectMedia(kind=kind, url=url, position=position)
        for position, (kind, url) in enumerate(items)
    ]


def load_entries(path: Path) -> list[dict[str, Any]]:
    entries = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(entries, list):
        raise TypeError(f"{path}: expected a JSON list of projects")
    return entries


async def upsert_demo(session: AsyncSession, entries: Sequence[dict[str, Any]]) -> int:
    """Insert or update one demo project per entry, in one transaction. Returns the count.

    Every entry is validated before the first write, so a bad entry changes nothing.
    """
    parsed = [(project_values(e), media_rows(e)) for e in entries]
    slugs = [values["slug"] for values, _ in parsed]
    if len(set(slugs)) != len(slugs):
        duplicates = sorted({s for s in slugs if slugs.count(s) > 1})
        raise ValueError(f"duplicate slugs in the seed file: {', '.join(duplicates)}")

    stmt = (
        select(Project)
        .options(selectinload(Project.media))
        .where(Project.is_demo, Project.slug.in_(slugs))
    )
    existing = {p.slug: p for p in await session.scalars(stmt)}
    for values, media in parsed:
        project = existing.get(values["slug"])
        if project is None:
            project = Project(**values)
            session.add(project)
        else:
            for column, value in values.items():
                setattr(project, column, value)
        project.media = media  # delete-orphan removes the previous rows
    await session.commit()
    return len(parsed)


async def delete_demo(session: AsyncSession) -> int:
    """Remove every demo project. Media rows go with them (ON DELETE CASCADE)."""
    result = await session.execute(delete(Project).where(Project.is_demo))
    await session.commit()
    return result.rowcount  # type: ignore[attr-defined,no-any-return]


async def _run(args: argparse.Namespace) -> int:
    entries = None if args.delete else load_entries(args.file)
    try:
        async with AsyncSession(get_engine(), expire_on_commit=False) as session:
            if entries is None:
                print(f"Deleted {await delete_demo(session)} demo projects")
            else:
                print(f"Upserted {await upsert_demo(session, entries)} demo projects")
    finally:
        await dispose_engine()
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.projects.seed_demo", description=__doc__)
    parser.add_argument("--file", type=Path, default=DEFAULT_SEED_FILE, help="seed JSON file")
    parser.add_argument("--delete", action="store_true", help="remove every demo project")
    args = parser.parse_args(argv)

    if get_settings().app_env == "production":
        print("seed_demo: refusing to run when APP_ENV=production", file=sys.stderr)
        return EXIT_REFUSED
    try:
        return asyncio.run(_run(args))
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"seed_demo: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
