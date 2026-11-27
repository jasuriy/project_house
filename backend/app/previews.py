"""Feed previews: a short, light copy of each project's demo video (Bek, 2026-11-27, D34).

The feed plays videos on its own as cards scroll into view, as Instagram does. The uploaded file
can be up to 300 MB, too heavy for a grid of cards on a phone, so after Render a separate job makes
the first few seconds at a small size, without sound, and stores it next to the video.

The API does not make the copy itself (it takes seconds of CPU). Render only hands the project
over through a "starter". The default starter does nothing, so local runs and tests never touch
the real bucket; production (modal_app.py) replaces it with one that starts the job on Modal.
A project without a preview simply shows its first frame in the feed.
"""

import asyncio
import logging
import tempfile
import uuid
from collections.abc import Awaitable, Callable
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionFactory
from app.projects.models import Project
from app.storage import Storage, get_storage

logger = logging.getLogger(__name__)

PREVIEW_SECONDS = 6
PREVIEW_HEIGHT = 480  # px; a feed card is at most about 260 px tall, so this is sharp at 2x
ENCODE_TIMEOUT_SECONDS = 240


class PreviewFailed(Exception):
    """ffmpeg could not make the copy (unreadable video, timeout)."""


def ffmpeg_command(source: str, target: str) -> list[str]:
    """The first PREVIEW_SECONDS of the video: no sound, at most PREVIEW_HEIGHT tall and 30 frames
    per second, H.264 with the index at the start (it can begin playing before it has loaded)."""
    return [
        "ffmpeg", "-nostdin", "-v", "error", "-y",
        # As an input option, -t stops reading after these seconds: only that part is downloaded.
        "-t", str(PREVIEW_SECONDS), "-i", source,
        "-an",
        # Never enlarged; the height is kept even, which yuv420p requires.
        "-vf", f"scale=-2:'min({PREVIEW_HEIGHT},trunc(ih/2)*2)'",
        "-fpsmax", "30",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        target,
    ]  # fmt: skip


async def encode(source: str, target: str) -> None:
    process = await asyncio.create_subprocess_exec(
        *ffmpeg_command(source, target),
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, stderr = await asyncio.wait_for(process.communicate(), ENCODE_TIMEOUT_SECONDS)
    except TimeoutError:
        process.kill()
        await process.wait()
        raise PreviewFailed(f"ffmpeg took longer than {ENCODE_TIMEOUT_SECONDS} s") from None
    if process.returncode != 0:
        raise PreviewFailed(stderr.decode(errors="replace").strip()[-500:])


async def build_preview(
    session: AsyncSession, storage: Storage, project_id: uuid.UUID
) -> str | None:
    """Makes and stores the preview of one project, and returns its key (None without a video)."""
    project = await session.get(Project, project_id)
    if project is None or not project.video_key:
        return None
    with tempfile.TemporaryDirectory() as folder:
        target = str(Path(folder) / "preview.mp4")
        # ffmpeg reads the video straight from R2 through a signed link.
        await encode(storage.presign_get(project.video_key), target)
        key = f"previews/{project_id}/{uuid.uuid4().hex}.mp4"
        await storage.upload_file(target, key, "video/mp4")
    previous, project.preview_key = project.preview_key, key
    await session.commit()
    if previous:
        try:
            await storage.delete(previous)
        except Exception:
            logger.exception(
                "Could not delete the old preview %s; it is left in the bucket", previous
            )
    return key


async def build_one(project_id: uuid.UUID) -> str | None:
    """The job's entry point: its own session and the real storage."""
    async with SessionFactory() as session:
        return await build_preview(session, get_storage(), project_id)


async def backfill() -> dict[str, int]:
    """Makes the missing previews (projects published before previews existed, or a failed job)."""
    async with SessionFactory() as session:
        ids = (
            await session.scalars(
                select(Project.id).where(
                    Project.video_key.is_not(None), Project.preview_key.is_(None)
                )
            )
        ).all()
    made = failed = 0
    for project_id in ids:
        try:
            await build_one(project_id)
            made += 1
        except Exception:
            failed += 1
            logger.exception("No preview for project %s", project_id)
    return {"made": made, "failed": failed}


# --- handing a new project over to the job ------------------------------------------------------

PreviewStarter = Callable[[uuid.UUID], Awaitable[None]]


async def no_preview(project_id: uuid.UUID) -> None:
    """Default starter: makes nothing (local runs and tests). Production replaces it."""


def get_preview_starter() -> PreviewStarter:
    return no_preview


async def start_quietly(starter: PreviewStarter, project_id: uuid.UUID) -> None:
    """Hands the project over; a failure is only logged. The project is already saved, so Render
    must still succeed (a retry would publish it twice), and the card shows its first frame."""
    try:
        await starter(project_id)
    except Exception:
        logger.exception("Could not start the preview job for project %s", project_id)
