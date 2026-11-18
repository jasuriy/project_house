import re


def slugify(title: str) -> str:
    """Lowercase; every run of characters outside [a-z0-9] becomes one '-'; trimmed."""
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
