"""Origin check for state-changing requests (architecture section 6).

Pure ASGI middleware. It returns the error response instead of raising AppError, because user
middleware runs outside the exception handlers (a raise would become a 500).
"""

from urllib.parse import urlsplit

from starlette.datastructures import Headers
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import get_settings
from app.core.errors import error_response

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_DEFAULT_PORTS = {"http": 80, "https": 443}


def origin_of(url: str) -> str | None:
    """`scheme://host[:port]` of `url`, lowercased, default port dropped; None if `url` has no
    http(s) origin (for example the literal "null")."""
    try:
        parts = urlsplit(url)
        host, port = parts.hostname, parts.port
    except ValueError:
        return None
    if parts.scheme not in _DEFAULT_PORTS or not host:
        return None
    if port is None or port == _DEFAULT_PORTS[parts.scheme]:
        return f"{parts.scheme}://{host}"
    return f"{parts.scheme}://{host}:{port}"


def _origin_allowed(headers: Headers) -> bool:
    """The Origin header decides; Referer is used only when Origin is absent."""
    sent = headers.get("origin")
    if sent is None:
        sent = headers.get("referer")
    if sent is None:
        return False
    # Read per request: settings can be rebuilt after the app is created.
    allowed = origin_of(get_settings().public_base_url)
    return allowed is not None and origin_of(sent) == allowed


class OriginCheckMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] == "http"
            and scope["method"] in UNSAFE_METHODS
            and scope["path"].startswith("/api/")
            and not _origin_allowed(Headers(scope=scope))
        ):
            response = error_response(403, "bad_origin", "Request origin is not allowed")
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)
