"""Where image files live, chosen by MEDIA_BACKEND: a folder on disk (local development) or
Cloudflare R2 (the deployment).

Files are named by a random key `<32 hex>.webp`; the database stores the key, never a URL, and
URLs are built here when a response is made. Every file operation runs in a worker thread, so a
slow disk or a slow R2 call never stalls other requests.
"""

import logging
import re
import threading
import uuid
from pathlib import Path
from typing import Any

import anyio
from botocore.exceptions import ClientError

from app.core.config import get_settings

KEY = re.compile(r"[0-9a-f]{32}\.webp")
logger = logging.getLogger(__name__)


def is_key(key: str) -> bool:
    """A well-formed key; anything else is never looked up (no path can leave the folder)."""
    return KEY.fullmatch(key) is not None


def url(key: str) -> str:
    """Images are served by the API in both backends (R2's own public address is for development
    only, and the API's long cache header lets the CDN in front of it keep each image)."""
    return f"{get_settings().public_base_url}/api/v1/media/{key}"


def _backend() -> str:
    return get_settings().media_backend


# ---- disk ------------------------------------------------------------------------------------


def _root() -> Path:
    root = Path(get_settings().media_root)
    root.mkdir(parents=True, exist_ok=True)
    return root


def _disk_read(key: str) -> bytes | None:
    file = _root() / key
    return file.read_bytes() if file.is_file() else None


# ---- R2 (S3-compatible API) ------------------------------------------------------------------


_CLIENT: Any = None
_CLIENT_LOCK = threading.Lock()


def _client() -> Any:
    """One S3 client for the process. Using a client from many threads is safe; creating one is
    not (boto3's shared session), so it is built once, under a lock, on its own session. Short
    timeouts and two tries: a slow R2 must not hold a request (or a worker thread) for minutes."""
    global _CLIENT
    with _CLIENT_LOCK:
        if _CLIENT is None:
            import boto3  # only the deployment needs it loaded
            from botocore.config import Config

            settings = get_settings()
            _CLIENT = boto3.session.Session().client(
                "s3",
                endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
                aws_access_key_id=settings.r2_access_key_id,
                aws_secret_access_key=settings.r2_secret_access_key,
                region_name="auto",
                config=Config(
                    connect_timeout=5,
                    read_timeout=15,
                    retries={"total_max_attempts": 2, "mode": "standard"},
                ),
            )
        return _CLIENT


def _r2_put(key: str, data: bytes) -> None:
    _client().put_object(
        Bucket=get_settings().r2_bucket, Key=key, Body=data, ContentType="image/webp"
    )


def _r2_get(key: str) -> bytes | None:
    try:
        answer = _client().get_object(Bucket=get_settings().r2_bucket, Key=key)
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") in {"NoSuchKey", "404"}:
            return None
        raise
    return answer["Body"].read()


def _r2_delete(key: str) -> None:
    _client().delete_object(Bucket=get_settings().r2_bucket, Key=key)


# ---- the four operations ---------------------------------------------------------------------


async def save(data: bytes) -> str:
    key = f"{uuid.uuid4().hex}.webp"
    if _backend() == "r2":
        await anyio.to_thread.run_sync(_r2_put, key, data)
    else:
        await anyio.to_thread.run_sync((_root() / key).write_bytes, data)
    return key


async def read(key: str) -> bytes | None:
    """The image's bytes; None for a malformed or missing key."""
    if not is_key(key):
        return None
    if _backend() == "r2":
        return await anyio.to_thread.run_sync(_r2_get, key)
    return await anyio.to_thread.run_sync(_disk_read, key)


async def delete(key: str) -> None:
    """Callers delete after their commit, so a failure here must not fail a change that is
    already saved: it is logged (the file stays behind) and the request goes on."""
    if not is_key(key):
        return
    try:
        if _backend() == "r2":
            await anyio.to_thread.run_sync(_r2_delete, key)
        else:
            await anyio.to_thread.run_sync(lambda: (_root() / key).unlink(missing_ok=True))
    except Exception as error:  # noqa: BLE001 - any storage failure: log it, keep the request
        logger.warning("Storage could not delete %s: %s", key, type(error).__name__)
