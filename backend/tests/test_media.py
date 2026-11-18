"""Image uploads (POST /api/v1/me/uploads), disk storage and the media route."""

import io
import struct
import zlib
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from PIL import Image
from sqlalchemy import func, select, update

from app.core.config import get_settings
from app.core.errors import AppError
from app.media.models import Upload
from app.media.service import consume_uploads
from tests.auth_helpers import signup_body

pytest_plugins = ["tests.auth_fixtures"]

UPLOADS = "/api/v1/me/uploads"
LIMIT = 5 * 1024 * 1024


@pytest.fixture(autouse=True)
def media_root(tmp_path, monkeypatch) -> Path:
    monkeypatch.setattr(get_settings(), "media_root", str(tmp_path))
    return tmp_path


def image_bytes(fmt: str = "PNG", size: tuple[int, int] = (40, 30), **save) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buffer, fmt, **save)
    return buffer.getvalue()


def png_claiming(width: int, height: int) -> bytes:
    """A tiny PNG whose header claims `width` x `height` (a decompression bomb, without the RAM)."""
    data = bytearray(image_bytes("PNG", (1, 1)))
    data[16:24] = struct.pack(">II", width, height)  # IHDR width, height
    data[29:33] = struct.pack(">I", zlib.crc32(bytes(data[12:29])))  # IHDR CRC over type + data
    return bytes(data)


async def _signup(client, username: str = "bek", account_type: str = "developer") -> None:
    body = signup_body(
        username=username, email=f"{username}@example.com", account_type=account_type
    )
    assert (await client.post("/api/v1/auth/signup", json=body)).status_code == 201


async def _upload(client, data: bytes, content_type: str = "image/png"):
    return await client.post(UPLOADS, content=data, headers={"content-type": content_type})


def _code(response) -> str:
    return response.json()["error"]["code"]


async def test_upload_png_returns_id_and_webp_url(auth_client):
    await _signup(auth_client)
    r = await _upload(auth_client, image_bytes())
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["url"].startswith(get_settings().public_base_url + "/api/v1/media/")
    assert body["url"].endswith(".webp")
    served = await auth_client.get(body["url"].removeprefix(get_settings().public_base_url))
    assert served.status_code == 200
    assert served.headers["content-type"] == "image/webp"
    assert served.headers["x-content-type-options"] == "nosniff"


async def test_upload_strips_metadata_and_resizes(auth_client, media_root):
    await _signup(auth_client)
    exif = Image.Exif()
    exif[0x010F] = "SecretCam"  # camera maker
    data = image_bytes("JPEG", (3000, 1000), exif=exif)
    url = (await _upload(auth_client, data, "image/jpeg")).json()["url"]
    stored = Image.open(media_root / url.rsplit("/", 1)[1])
    assert (stored.format, stored.size) == ("WEBP", (1600, 533))
    assert not stored.getexif()


@pytest.mark.parametrize(
    ("data", "content_type"),
    [
        (b"not an image at all", "image/png"),
        (b"", "image/png"),
        (image_bytes("GIF"), "image/gif"),
        (image_bytes("GIF"), "image/png"),
    ],
)
async def test_upload_rejects_non_images(auth_client, data, content_type):
    await _signup(auth_client)
    r = await _upload(auth_client, data, content_type)
    assert (r.status_code, _code(r)) == (422, "invalid_image")


async def test_upload_over_5mb_is_413(auth_client):
    await _signup(auth_client)
    r = await _upload(auth_client, b"\0" * (LIMIT + 1))
    assert (r.status_code, _code(r)) == (413, "image_too_large")


async def test_upload_over_5mb_without_content_length_is_413(auth_client):
    await _signup(auth_client)

    async def chunks():
        for _ in range(6):
            yield b"\0" * (1024 * 1024)

    r = await auth_client.post(UPLOADS, content=chunks(), headers={"content-type": "image/png"})
    assert (r.status_code, _code(r)) == (413, "image_too_large")


@pytest.mark.parametrize("size", [(20000, 20000), (7000, 7000)])  # 400 MP, and 49 MP (1x-2x limit)
async def test_upload_rejects_a_header_claiming_huge_pixels(auth_client, size):
    await _signup(auth_client)
    r = await _upload(auth_client, png_claiming(*size))
    assert (r.status_code, _code(r)) == (422, "invalid_image")


async def test_pixel_limit_is_checked_before_decoding(auth_client, monkeypatch):
    # A valid 20x20 image (400 px) over a lowered limit: only the header check can refuse it.
    monkeypatch.setattr("app.media.images.MAX_PIXELS", 100)
    await _signup(auth_client)
    r = await _upload(auth_client, image_bytes("PNG", (20, 20)))
    assert (r.status_code, _code(r)) == (422, "invalid_image")


async def test_upload_requires_login(auth_client):
    r = await _upload(auth_client, image_bytes())
    assert r.status_code == 401


async def test_upload_by_company_is_403(auth_client):
    await _signup(auth_client, account_type="company")
    r = await _upload(auth_client, image_bytes())
    assert (r.status_code, _code(r)) == (403, "developers_only")


async def test_thirteenth_unused_upload_is_429(auth_client):
    await _signup(auth_client)
    for _ in range(12):
        assert (await _upload(auth_client, image_bytes())).status_code == 201
    r = await _upload(auth_client, image_bytes())
    assert (r.status_code, _code(r)) == (429, "too_many_uploads")


async def test_old_unused_uploads_of_anyone_are_cleaned(
    auth_client, client, db_session, media_root
):
    await _signup(auth_client, "alice")
    old_url = (await _upload(auth_client, image_bytes())).json()["url"]
    await db_session.execute(
        update(Upload).values(created_at=datetime.now(UTC) - timedelta(hours=25))
    )
    await db_session.commit()
    await auth_client.post("/api/v1/auth/logout")
    await _signup(auth_client, "bobby")
    assert (await _upload(auth_client, image_bytes())).status_code == 201

    assert await db_session.scalar(select(func.count()).select_from(Upload)) == 1
    assert not (media_root / old_url.rsplit("/", 1)[1]).exists()


@pytest.mark.parametrize("key", ["..%2Fsecret.webp", "abc.png", "x", "0" * 32 + ".png"])
async def test_media_route_rejects_bad_keys(client, key):
    assert (await client.get(f"/api/v1/media/{key}")).status_code == 404


async def test_consume_uploads_only_own_and_once(auth_client, db_session):
    await _signup(auth_client, "alice")
    upload_id = (await _upload(auth_client, image_bytes())).json()["id"]
    (alice,) = await db_session.scalars(select(Upload.owner_id))

    with pytest.raises(AppError) as exc:
        await consume_uploads(db_session, alice + 1, [upload_id])
    assert exc.value.code == "invalid_images"
    await db_session.rollback()

    assert len(await consume_uploads(db_session, alice, [upload_id])) == 1
    await db_session.commit()
    with pytest.raises(AppError):
        await consume_uploads(db_session, alice, [upload_id])
