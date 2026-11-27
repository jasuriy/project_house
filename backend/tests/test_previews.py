"""Feed previews (D34): Render hands the project to the preview job, the job makes a short, light,
silent copy, and the feed links it. ffmpeg runs for real on a generated clip; storage is a fake."""

import json
import shutil
import subprocess
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.accounts.models import User
from app.db import SessionFactory
from app.main import app
from app.previews import (
    PREVIEW_HEIGHT,
    PREVIEW_SECONDS,
    PreviewFailed,
    build_preview,
    get_preview_starter,
)
from app.projects.models import Project
from tests.fakes import FakeStorage, GitHubRoutes, repo_routes
from tests.test_projects import reflex_payload, row_count

# Render needs an account: every test here runs logged in (conftest.author).
pytestmark = pytest.mark.usefixtures("author")

needs_ffmpeg = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg is not installed")


@pytest.fixture
def reflex_repo(github_routes: GitHubRoutes, reflex_readme: str) -> None:
    github_routes.update(repo_routes("reflex-dev", "reflex", reflex_readme))


@pytest.fixture
def started() -> Iterator[list[uuid.UUID]]:
    """Records the projects Render hands over, instead of starting a real job."""
    calls: list[uuid.UUID] = []

    async def record(project_id: uuid.UUID) -> None:
        calls.append(project_id)

    app.dependency_overrides[get_preview_starter] = lambda: record
    yield calls
    app.dependency_overrides.pop(get_preview_starter, None)


class LocalVideos(FakeStorage):
    """A fake storage whose download links are local files, so ffmpeg can read them."""

    def __init__(self, videos: dict[str, Path]) -> None:
        super().__init__()
        self.videos = videos

    def presign_get(self, key: str) -> str:
        return str(self.videos.get(key, Path("missing.mp4")))


def make_clip(path: Path, seconds: int, size: str = "1280x720") -> Path:
    """A test video with sound: a moving pattern and a tone."""
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y",
         "-f", "lavfi", "-i", f"testsrc=duration={seconds}:size={size}:rate=60",
         "-f", "lavfi", "-i", f"sine=duration={seconds}",
         "-c:v", "libx264", "-c:a", "aac", "-shortest", str(path)],
        check=True,
    )  # fmt: skip
    return path


def probe(data: bytes, folder: Path) -> dict:
    path = folder / "probe.mp4"
    path.write_bytes(data)
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "stream=codec_type,codec_name,width,height,avg_frame_rate:format=duration",
         "-of", "json", str(path)],
        check=True, capture_output=True, text=True,
    )  # fmt: skip
    return json.loads(out.stdout)


async def add_project(video_key: str | None, preview_key: str | None = None) -> uuid.UUID:
    project_id = uuid.uuid4()
    async with SessionFactory() as session:
        owner = await session.scalar(select(User.id).where(User.username == "ada"))
        session.add(
            Project(
                id=project_id,
                slug=f"p-{project_id.hex[:8]}",
                published_at=datetime.now(UTC),
                name="Sample",
                video_key=video_key,
                preview_key=preview_key,
                owner_id=owner,
            )
        )
        await session.commit()
    return project_id


async def stored_preview_key(project_id: uuid.UUID) -> str | None:
    async with SessionFactory() as session:
        return (await session.get(Project, project_id)).preview_key


# --- Render hands over ------------------------------------------------------------------------


async def test_render_hands_the_new_project_to_the_preview_job(
    client: AsyncClient, storage: FakeStorage, reflex_repo: None, started: list[uuid.UUID]
) -> None:
    created = await client.post("/api/v1/projects", json=await reflex_payload(client, storage))

    assert created.status_code == 201, created.text
    assert started == [uuid.UUID(created.json()["id"])]


async def test_render_still_succeeds_when_the_job_cannot_start(
    client: AsyncClient, storage: FakeStorage, reflex_repo: None
) -> None:
    async def broken(project_id: uuid.UUID) -> None:
        raise ConnectionError("Modal is unreachable")

    app.dependency_overrides[get_preview_starter] = lambda: broken
    try:
        created = await client.post("/api/v1/projects", json=await reflex_payload(client, storage))
    finally:
        app.dependency_overrides.pop(get_preview_starter, None)

    # The row is saved before the hand-off; a 500 here would make a retry publish it twice.
    assert created.status_code == 201, created.text
    assert await row_count() == 1


# --- the feed links it ------------------------------------------------------------------------


async def test_feed_card_links_the_preview_once_it_exists(client: AsyncClient) -> None:
    await add_project("videos/a/v.mp4")
    with_preview = await add_project("videos/b/v.mp4", preview_key="previews/b/p.mp4")

    items = (await client.get("/api/v1/projects")).json()["items"]
    links = {item["slug"]: item["preview_url"] for item in items}

    assert links[f"p-{with_preview.hex[:8]}"] == "https://r2.test/download/previews/b/p.mp4"
    assert None in links.values()  # the other one has none yet


# --- the job --------------------------------------------------------------------------------


@needs_ffmpeg
async def test_preview_is_the_first_seconds_small_and_silent(tmp_path: Path) -> None:
    storage = LocalVideos({"videos/x/v.mp4": make_clip(tmp_path / "source.mp4", seconds=10)})
    project_id = await add_project("videos/x/v.mp4")

    async with SessionFactory() as session:
        key = await build_preview(session, storage, project_id)

    assert key is not None and key.startswith(f"previews/{project_id}/") and key.endswith(".mp4")
    assert await stored_preview_key(project_id) == key
    assert storage.files[key].content_type == "video/mp4"
    info = probe(storage.uploaded[key], tmp_path)
    assert [s["codec_type"] for s in info["streams"]] == ["video"]  # no sound
    video = info["streams"][0]
    assert video["codec_name"] == "h264"
    assert (video["width"], video["height"]) == (854, PREVIEW_HEIGHT)  # 16:9 kept, even width
    assert video["avg_frame_rate"] == "30/1"  # 60 fps source capped
    assert abs(float(info["format"]["duration"]) - PREVIEW_SECONDS) < 0.1


@needs_ffmpeg
async def test_short_or_small_video_is_neither_padded_nor_enlarged(tmp_path: Path) -> None:
    clip = make_clip(tmp_path / "source.mp4", seconds=3, size="640x360")
    storage = LocalVideos({"videos/x/v.mp4": clip})
    project_id = await add_project("videos/x/v.mp4")

    async with SessionFactory() as session:
        key = await build_preview(session, storage, project_id)

    info = probe(storage.uploaded[key], tmp_path)
    assert (info["streams"][0]["width"], info["streams"][0]["height"]) == (640, 360)
    assert abs(float(info["format"]["duration"]) - 3) < 0.1


@needs_ffmpeg
async def test_a_new_preview_replaces_the_old_one(tmp_path: Path) -> None:
    storage = LocalVideos({"videos/x/v.mp4": make_clip(tmp_path / "source.mp4", seconds=2)})
    project_id = await add_project("videos/x/v.mp4", preview_key="previews/old.mp4")

    async with SessionFactory() as session:
        key = await build_preview(session, storage, project_id)

    assert await stored_preview_key(project_id) == key
    assert storage.deleted == ["previews/old.mp4"]


@needs_ffmpeg
async def test_unreadable_video_leaves_the_project_as_it_was(tmp_path: Path) -> None:
    storage = LocalVideos({})  # the link points at a file that does not exist
    project_id = await add_project("videos/x/v.mp4")

    async with SessionFactory() as session:
        with pytest.raises(PreviewFailed):
            await build_preview(session, storage, project_id)

    assert await stored_preview_key(project_id) is None
    assert storage.uploaded == {}


async def test_project_without_a_video_gets_no_preview() -> None:
    storage = FakeStorage()
    project_id = await add_project(None)

    async with SessionFactory() as session:
        assert await build_preview(session, storage, project_id) is None
    assert storage.uploaded == {}
