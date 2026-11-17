"""Load the temporary demo projects (seed/demo-projects.json) into the database.

    python -m app.projects.seed_demo [--file PATH] [--delete]

Idempotent: demo rows are upserted by slug, and a demo project's media is replaced with the
entry's current media. `--delete` removes every demo row (media cascade in the database).
Refuses to run when APP_ENV=production (exit code 2), before any database access.
"""

import argparse
import asyncio
import json
import os
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

from app.core.db import dispose_engine, get_engine
from app.projects.models import Project, ProjectMedia

# This file is <repo>/backend/app/projects/seed_demo.py: never resolved from the working directory.
DEFAULT_SEED_FILE = Path(__file__).resolve().parents[3] / "seed" / "demo-projects.json"

VIDEO_HOSTS = ("youtube.com", "youtu.be", "loom.com", "vimeo.com")


def slugify(title: str) -> str:
    """Lowercase; every run of characters outside [a-z0-9] becomes one '-'; trimmed."""
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")


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


def project_values(entry: dict[str, Any]) -> dict[str, Any]:
    """Project columns for one seed entry. Pure: no database access."""
    return {
        "is_demo": True,
        "owner_id": None,
        "slug": slugify(entry["title"]),
        "title": entry["title"],
        "one_line_problem": entry["one_line_problem"],
        "short_description": entry["short_description"],
        "result": entry["result"],
        "field": entry["field"],
        "tech_stack": list(entry["tech_stack"]),
        "github_url": entry["repo_url"],
        # The seed's `link` is the live site; when it is only the repository again, there is none.
        "live_url": None
        if entry["link"].rstrip("/") == entry["repo_url"].rstrip("/")
        else entry["link"],
        "demo_video_url": entry["demo_video_url"],
        "license": entry["license"],
        "role": None,
        "demo_author": entry["original_author"],
        "demo_author_url": "https://github.com/"
        + urlparse(entry["repo_url"]).path.strip("/").split("/")[0],
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


async def upsert_demo(session: AsyncSession, entries: Sequence[dict[str, Any]]) -> int:
    """Insert or update one demo project per entry, in one transaction. Returns the count."""
    parsed = [(project_values(e), media_rows(e)) for e in entries]
    slugs = [values["slug"] for values, _ in parsed]

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
    entries = None if args.delete else json.loads(args.file.read_text(encoding="utf-8"))
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

    # Read the environment directly: production Settings can fail validation, and the refusal
    # must come first, before any settings or database access.
    if os.environ.get("APP_ENV") == "production":
        print("seed_demo: refusing to run when APP_ENV=production", file=sys.stderr)
        return 2
    return asyncio.run(_run(args))


if __name__ == "__main__":
    sys.exit(main())
