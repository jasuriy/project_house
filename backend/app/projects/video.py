"""Video links the project page can play (mirrors frontend/src/lib/media.ts)."""

import re
from urllib.parse import parse_qs, urlsplit

YOUTUBE_ID = re.compile(r"[A-Za-z0-9_-]{11}")
YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com"}
LOOM_ID = re.compile(r"[A-Za-z0-9]{1,64}")


def youtube_id(url: str) -> str | None:
    """The id of a YouTube watch, youtu.be, /embed/ or /shorts/ URL, else None."""
    try:
        parts = urlsplit(url)
    except ValueError:
        return None
    if parts.scheme not in ("http", "https"):
        return None
    candidate = None
    if parts.hostname == "youtu.be":
        candidate = parts.path[1:]
    elif parts.hostname in YOUTUBE_HOSTS:
        segments = parts.path.split("/")
        if len(segments) > 1 and segments[1] == "watch":
            candidate = parse_qs(parts.query).get("v", [None])[0]
        elif len(segments) > 2 and segments[1] in ("embed", "shorts"):
            candidate = segments[2]
    return candidate if candidate and YOUTUBE_ID.fullmatch(candidate) else None


def is_playable(url: str) -> bool:
    """A YouTube link, or a Loom share/embed link: the two the add form accepts."""
    if youtube_id(url):
        return True
    try:
        parts = urlsplit(url)
    except ValueError:
        return False
    if parts.scheme not in ("http", "https"):
        return False
    host = (parts.hostname or "").removeprefix("www.")
    segments = parts.path.split("/")
    return (
        host == "loom.com"
        and len(segments) > 2
        and segments[1] in ("share", "embed")
        and LOOM_ID.fullmatch(segments[2]) is not None
    )
