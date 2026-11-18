"""Where image files live. Disk now; at deploy only this module changes (Cloudflare R2).

Files are named by a random key `<32 hex>.webp`; the database stores the key, never a URL, and
URLs are built here when a response is made.
"""

import re
import uuid
from pathlib import Path

from app.core.config import get_settings

KEY = re.compile(r"[0-9a-f]{32}\.webp")


def _root() -> Path:
    root = Path(get_settings().media_root)
    root.mkdir(parents=True, exist_ok=True)
    return root


def save(data: bytes) -> str:
    key = f"{uuid.uuid4().hex}.webp"
    (_root() / key).write_bytes(data)
    return key


def path(key: str) -> Path | None:
    """The file of a well-formed key (None for anything else, so no path can leave the folder)."""
    if not KEY.fullmatch(key):
        return None
    return _root() / key


def url(key: str) -> str:
    return f"{get_settings().public_base_url}/api/v1/media/{key}"


def delete(key: str) -> None:
    file = path(key)
    if file is not None:
        file.unlink(missing_ok=True)
