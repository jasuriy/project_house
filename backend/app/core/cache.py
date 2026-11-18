"""API answers are never cached by a proxy (the deploy puts Vercel's CDN in front of the API).

Many answers depend on who asks (liked, saved, your lists, can_delete), so every /api answer says
`private, no-store`. Images under /api/v1/media keep their own long public header: their keys
never change. Pure ASGI middleware, like the Origin check, so it also covers error answers.
"""

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

NO_STORE = "private, no-store"


class NoStoreApiMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        path = scope.get("path", "") if scope["type"] == "http" else ""
        if not path.startswith("/api/") or path.startswith("/api/v1/media/"):
            await self.app(scope, receive, send)
            return

        async def send_with_header(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                if "cache-control" not in headers:
                    headers["cache-control"] = NO_STORE
            await send(message)

        await self.app(scope, receive, send_with_header)
