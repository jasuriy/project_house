"""Builders for the tests that upload images (the media folder fixture is in media_fixtures.py)."""

import io
from pathlib import Path

from PIL import Image

from tests.auth_helpers import signup_body

UPLOADS = "/api/v1/me/uploads"


def image_bytes(fmt: str = "PNG", size: tuple[int, int] = (40, 30), **save) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buffer, fmt, **save)
    return buffer.getvalue()


async def signup(client, username: str = "bek", account_type: str = "developer") -> None:
    body = signup_body(
        username=username, email=f"{username}@example.com", account_type=account_type
    )
    response = await client.post("/api/v1/auth/signup", json=body)
    assert response.status_code == 201, response.text


async def upload(client, data: bytes | None = None, content_type: str = "image/png"):
    return await client.post(
        UPLOADS,
        content=image_bytes() if data is None else data,
        headers={"content-type": content_type},
    )


def file_of(media_root: Path, url: str) -> Path:
    return media_root / url.rsplit("/", 1)[1]
