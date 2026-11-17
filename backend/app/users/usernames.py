import re

from app.core.errors import AppError

USERNAME_PATTERN = re.compile(r"[a-z0-9_-]{3,30}")

# Extended as routes appear. Keep in sync with architecture section 4.
RESERVED_USERNAMES = frozenset(
    [
        "uz",
        "ru",
        "en",
        "api",
        "_next",
        "_vercel",
        "demo",
        "new",
        "messages",
        "settings",
        "login",
        "logout",
        "signup",
        "admin",
        "explore",
        "feed",
        "search",
        "about",
        "help",
    ]
)


def validate_username(name: str) -> None:
    """Raise AppError(422, "invalid_username") unless `name` is a usable username."""
    if not USERNAME_PATTERN.fullmatch(name):
        raise AppError(
            422,
            "invalid_username",
            "Username must be 3-30 characters: lowercase letters, digits, '-' or '_'",
        )
    if name in RESERVED_USERNAMES:
        raise AppError(422, "invalid_username", "This username is reserved")
