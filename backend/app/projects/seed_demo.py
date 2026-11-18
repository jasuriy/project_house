"""Load the temporary demo projects (seed/demo-projects.json) into the database.

    python -m app.projects.seed_demo [--file PATH] [--owner USERNAME]

Idempotent: demo rows are upserted by slug, and a demo project's media is replaced with the
entry's current media. `--owner` gives every sample to that existing account, so they show as
that person's posts (Bek, 2026-11-18: development data, deleted later with the delete button);
without it a row keeps the owner it has. Refuses to run when APP_ENV=production (exit code 2),
before any database access.
"""

import argparse
import asyncio
import json
import os
import sys
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import dispose_engine, get_engine
from app.projects.models import Project, ProjectMedia
from app.projects.slugs import slugify
from app.users import service as users_service

# This file is <repo>/backend/app/projects/seed_demo.py: never resolved from the working directory.
DEFAULT_SEED_FILE = Path(__file__).resolve().parents[3] / "seed" / "demo-projects.json"

VIDEO_HOSTS = ("youtube.com", "youtu.be", "loom.com", "vimeo.com")


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


async def upsert_demo(
    session: AsyncSession, entries: Sequence[dict[str, Any]], owner_id: int | None = None
) -> int:
    """Insert or update one demo project per entry, in one transaction. Returns the count.
    `owner_id` (when given) becomes the owner of every entry; otherwise owners stay as they are."""
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
        if owner_id is not None:
            project.owner_id = owner_id
        project.media = media  # delete-orphan removes the previous rows
    await session.commit()
    return len(parsed)


async def _run(args: argparse.Namespace) -> int:
    entries = json.loads(args.file.read_text(encoding="utf-8"))
    try:
        async with AsyncSession(get_engine(), expire_on_commit=False) as session:
            owner_id = None
            if args.owner is not None:
                owner = await users_service.get_by_username(session, args.owner)
                if owner is None:
                    print(f"seed_demo: no account named {args.owner!r}", file=sys.stderr)
                    return 2
                owner_id = owner.id
            print(f"Upserted {await upsert_demo(session, entries, owner_id)} demo projects")
    finally:
        await dispose_engine()
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.projects.seed_demo", description=__doc__)
    parser.add_argument("--file", type=Path, default=DEFAULT_SEED_FILE, help="seed JSON file")
    parser.add_argument("--owner", help="username of the account that posts every sample")
    parser.add_argument(
        "--allow-production",
        action="store_true",
        help="load into production, once, onto --owner's account (Bek, 2026-11-18)",
    )
    args = parser.parse_args(argv)

    # Read the environment directly: production Settings can fail validation, and the refusal
    # must come first, before any settings or database access.
    if os.environ.get("APP_ENV") == "production":
        if not args.allow_production:
            print("seed_demo: refusing to run when APP_ENV=production", file=sys.stderr)
            return 2
        if args.owner is None:
            print("seed_demo: --allow-production needs --owner", file=sys.stderr)
            return 2
    return asyncio.run(_run(args))


if __name__ == "__main__":
    sys.exit(main())
