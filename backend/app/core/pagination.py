import base64
import binascii
import json
from datetime import UTC, datetime

from app.core.errors import AppError

MAX_CURSOR_LENGTH = 512
MAX_ID = 2**63 - 1  # bigint


def encode_cursor(published_at: datetime, id: int) -> str:
    """Opaque keyset cursor (parameter names are the task-file API): URL-safe base64 (no padding) of JSON {t: ISO UTC timestamp, i: id}."""
    if published_at.tzinfo is None:
        raise ValueError("published_at must be timezone-aware")
    payload = {"t": published_at.astimezone(UTC).isoformat(), "i": id}
    raw = json.dumps(payload, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def decode_cursor(cursor: str) -> tuple[datetime, int]:
    """Inverse of `encode_cursor`. Any malformed input raises AppError(400, "invalid_cursor")."""
    if len(cursor) > MAX_CURSOR_LENGTH:
        raise AppError(400, "invalid_cursor", "Invalid cursor")
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        published_at = datetime.fromisoformat(payload["t"])
        id_ = payload["i"]
        if published_at.tzinfo is None or type(id_) is not int or not 1 <= id_ <= MAX_ID:
            raise ValueError("cursor fields have the wrong type")
        # May raise OverflowError when the offset pushes the instant outside datetime's range.
        published_at = published_at.astimezone(UTC)
    except (binascii.Error, ValueError, KeyError, TypeError, OverflowError, RecursionError) as exc:
        raise AppError(400, "invalid_cursor", "Invalid cursor") from exc
    return published_at, id_
