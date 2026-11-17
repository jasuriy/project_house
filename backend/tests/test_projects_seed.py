import json
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.projects import seed_demo
from app.projects.models import Project, ProjectMedia
from tests.projects_fixtures import add_projects, make_project, make_user

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
REAL_SEED = REPO_ROOT / "seed" / "demo-projects.json"
LOADER_MESSAGE_PRODUCTION = "refusing to run when APP_ENV=production"


def run_loader(database_url: str, *args: str, app_env: str = "test") -> subprocess.CompletedProcess:
    """Run the real CLI in a subprocess against the test database."""
    # No SECRET_KEY: production Settings would fail validation, so the refusal must not load them.
    env = {k: v for k, v in os.environ.items() if k != "SECRET_KEY"}
    env |= {"DATABASE_URL": database_url, "APP_ENV": app_env}
    return subprocess.run(
        [sys.executable, "-m", "app.projects.seed_demo", *args],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


async def count(session, model) -> int:
    return await session.scalar(select(func.count()).select_from(model))


def seed_entries() -> list[dict]:
    return json.loads(REAL_SEED.read_text(encoding="utf-8"))


def entry(**overrides) -> dict:
    base = {
        "title": "Some Tool",
        "repo_url": "https://github.com/someone/some-tool",
        "original_author": "someone",
        "demo_video_url": None,
        "image_urls": [],
        "one_line_problem": "Problem.",
        "short_description": "Description.",
        "result": None,
        "tech_stack": ["Go"],
        "field": "devtools",
        "license": "MIT",
        "pushed_at": "2026-11-17",
    }
    base.update(overrides)
    return base


# ---- pure functions -----------------------------------------------------------------------


@pytest.mark.parametrize(
    ("title", "slug"),
    [
        ("screenpipe", "screenpipe"),
        ("Instant NGP", "instant-ngp"),
        ("OpenCat Quadruped Robot", "opencat-quadruped-robot"),
        ("  C++ / Rust!!  ", "c-rust"),
        ("gh-dash", "gh-dash"),
        ("Apache Superset", "apache-superset"),
    ],
)
def test_slugify(title, slug):
    assert seed_demo.slugify(title) == slug


def test_every_seed_title_gets_a_distinct_slug():
    slugs = [seed_demo.slugify(e["title"]) for e in seed_entries()]
    assert len(slugs) == 29
    assert len(set(slugs)) == 29


@pytest.mark.parametrize(
    "url",
    [
        "https://www.youtube.com/watch?v=abc",
        "https://youtu.be/abc",
        "https://www.loom.com/share/abc",
        "https://vimeo.com/123",
        "https://example.com/clip.mp4",
        "https://example.com/clip.MP4?raw=1",
        "https://github.com/apache/superset-site/raw/lfs/superset-video-4k.mp4",
    ],
)
def test_media_kind_video(url):
    assert seed_demo.media_kind(url) == "video"


@pytest.mark.parametrize(
    "url", ["https://example.com/demo.gif", "https://raw.githubusercontent.com/o/r/m/a.GIF"]
)
def test_media_kind_gif_is_image(url):
    assert seed_demo.media_kind(url) == "image"


@pytest.mark.parametrize(
    "url", ["https://notyoutube.com/watch?v=abc", "https://example.com/page", "https://x/y.png"]
)
def test_media_kind_unknown_url_is_an_error(url):
    with pytest.raises(ValueError, match="video"):
        seed_demo.media_kind(url)


def test_default_seed_file_is_resolved_from_the_module_not_the_cwd():
    assert seed_demo.DEFAULT_SEED_FILE == REAL_SEED
    assert seed_demo.DEFAULT_SEED_FILE.is_file()


def test_entry_mapping():
    values = seed_demo.project_values(
        entry(
            title="Instant NGP",
            repo_url="https://github.com/NVlabs/instant-ngp",
            original_author="NVlabs",
            pushed_at="2026-09-03",
            result="A claim.",
            license=None,
        )
    )
    assert values["slug"] == "instant-ngp"
    assert values["is_demo"] is True and values["owner_id"] is None
    assert values["github_url"] == "https://github.com/NVlabs/instant-ngp"
    assert values["demo_author"] == "NVlabs"
    assert values["demo_author_url"] == "https://github.com/NVlabs"
    assert values["published_at"] == datetime(2026, 9, 3, tzinfo=UTC)
    assert values["role"] is None
    assert values["result"] == "A claim."
    assert values["license"] is None
    assert values["tech_stack"] == ["Go"]


def test_media_rows_put_the_video_first_then_images_in_order():
    rows = seed_demo.media_rows(
        entry(
            demo_video_url="https://youtu.be/abc", image_urls=["https://x/1.png", "https://x/2.png"]
        )
    )
    assert [(m.position, m.kind, m.url) for m in rows] == [
        (0, "video", "https://youtu.be/abc"),
        (1, "image", "https://x/1.png"),
        (2, "image", "https://x/2.png"),
    ]


def test_media_rows_without_video_start_at_zero_and_gif_is_an_image():
    rows = seed_demo.media_rows(
        entry(demo_video_url="https://x/demo.gif", image_urls=["https://x/1.png"])
    )
    assert [(m.position, m.kind) for m in rows] == [(0, "image"), (1, "image")]
    assert [m.position for m in seed_demo.media_rows(entry(image_urls=["https://x/1.png"]))] == [0]


# ---- database -----------------------------------------------------------------------------


async def test_upsert_twice_leaves_29_projects_and_no_duplicate_media(db_session):
    entries = seed_entries()
    expected_media = sum(len(e["image_urls"]) + (1 if e["demo_video_url"] else 0) for e in entries)

    assert await seed_demo.upsert_demo(db_session, entries) == 29
    assert await seed_demo.upsert_demo(db_session, entries) == 29

    assert await count(db_session, Project) == 29
    assert await count(db_session, ProjectMedia) == expected_media
    assert await db_session.scalar(select(func.count()).where(Project.is_demo.is_(False))) == 0


async def test_upsert_updates_the_existing_row_and_replaces_its_media(db_session):
    first = entry(title="Some Tool", image_urls=["https://x/1.png", "https://x/2.png"])
    await seed_demo.upsert_demo(db_session, [first])
    original_id = await db_session.scalar(select(Project.id))

    changed = entry(
        title="Some Tool",
        short_description="New description.",
        tech_stack=["Rust", "C"],
        image_urls=["https://x/3.png"],
    )
    await seed_demo.upsert_demo(db_session, [changed])

    row = (await db_session.scalars(select(Project))).one()
    assert row.id == original_id
    assert row.short_description == "New description."
    assert row.tech_stack == ["Rust", "C"]
    urls = list(await db_session.scalars(select(ProjectMedia.url)))
    assert urls == ["https://x/3.png"]


async def test_upsert_never_touches_a_real_project_with_the_same_slug(db_session):
    user = await make_user(db_session)
    await add_projects(
        db_session,
        make_project(is_demo=False, owner_id=user.id, slug="some-tool", title="Mine"),
    )
    await seed_demo.upsert_demo(db_session, [entry(title="Some Tool")])
    titles = sorted(await db_session.scalars(select(Project.title)))
    assert titles == ["Mine", "Some Tool"]


async def test_one_bad_entry_writes_nothing(db_session):
    # The database CHECK rejects the bad field; the single commit means the good entry is lost too.
    with pytest.raises(IntegrityError, match="ck_projects_field"):
        await seed_demo.upsert_demo(
            db_session, [entry(title="Good"), entry(title="Bad", field="blockchain")]
        )
    await db_session.rollback()
    assert await count(db_session, Project) == 0


async def test_delete_demo_removes_demo_rows_and_media_but_keeps_real_projects(db_session):
    user = await make_user(db_session)
    await add_projects(db_session, make_project(is_demo=False, owner_id=user.id, slug="mine"))
    await seed_demo.upsert_demo(db_session, seed_entries())

    assert await seed_demo.delete_demo(db_session) == 29

    assert await count(db_session, Project) == 1
    assert await count(db_session, ProjectMedia) == 0


# ---- CLI (subprocess, real entry point) ----------------------------------------------------


async def test_cli_loads_the_real_seed_twice_then_deletes(db_session, test_database_url):
    expected_media = sum(
        len(e["image_urls"]) + (1 if e["demo_video_url"] else 0) for e in seed_entries()
    )

    for _ in range(2):
        result = run_loader(test_database_url)
        assert result.returncode == 0, result.stderr
        assert await count(db_session, Project) == 29
        assert await count(db_session, ProjectMedia) == expected_media
    assert "29" in result.stdout

    result = run_loader(test_database_url, "--delete")
    assert result.returncode == 0, result.stderr
    assert await count(db_session, Project) == 0
    assert await count(db_session, ProjectMedia) == 0


async def test_cli_loads_the_feed_end_to_end(client, test_database_url):
    assert run_loader(test_database_url).returncode == 0
    page = (await client.get("/api/v1/projects", params={"limit": 60})).json()
    assert len(page["items"]) == 29
    assert page["next_cursor"] is None
    detail = await client.get("/api/v1/projects/demo/instant-ngp")
    assert detail.status_code == 200
    assert detail.json()["author"]["name"] == "NVlabs"
    assert detail.json()["media"][0]["kind"] == "video"


@pytest.mark.parametrize("args", [(), ("--delete",)])
async def test_cli_refuses_in_production_and_writes_nothing(db_session, test_database_url, args):
    await seed_demo.upsert_demo(db_session, [entry(title="Keep Me")])
    assert await count(db_session, Project) == 1

    result = run_loader(test_database_url, *args, app_env="production")

    assert result.returncode == 2
    assert LOADER_MESSAGE_PRODUCTION in result.stderr
    assert "Traceback" not in result.stderr
    assert await count(db_session, Project) == 1


async def test_cli_production_refusal_does_not_depend_on_the_database_being_reachable(
    db_session, test_database_url
):
    unreachable = "postgresql+asyncpg://nobody:nobody@127.0.0.1:1/never"
    result = run_loader(unreachable, app_env="production")
    assert result.returncode == 2
    assert LOADER_MESSAGE_PRODUCTION in result.stderr
    assert "Traceback" not in result.stderr


async def test_cli_custom_file(db_session, test_database_url, tmp_path):
    path = tmp_path / "mini.json"
    path.write_text(
        json.dumps([entry(title="Mini One"), entry(title="Mini Two")]), encoding="utf-8"
    )
    result = run_loader(test_database_url, "--file", str(path))
    assert result.returncode == 0, result.stderr
    assert sorted(await db_session.scalars(select(Project.slug))) == ["mini-one", "mini-two"]
