"""Builds the FastAPI app: error handlers, routers, caching rule, and clean shutdown."""

from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response

from app import catalog, health
from app.accounts import router as accounts
from app.config import get_settings
from app.db import engine
from app.errors import error_response, register_error_handlers
from app.projects import router as projects


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()  # close pooled database connections on shutdown


async def no_store(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """API answers are never cached by the browser or a proxy (Vercel forwards /api/*).

    They carry signed file links that expire, and drafts that change every second.
    """
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response


CHANGES_DATA = {"POST", "PUT", "PATCH", "DELETE"}


async def same_site_only(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """A request that changes data must come from our own site (its Origin header).

    The login cookie travels with every request to the site, so without this check another site
    could make a visitor's browser send a POST in their name. Browsers always send Origin on
    these methods; a request without one is refused too.
    """
    if request.method in CHANGES_DATA:
        if request.headers.get("origin") != get_settings().site_origin:
            return error_response(403, "origin_not_allowed", "Requests must come from the site")
    return await call_next(request)


def create_app() -> FastAPI:
    app = FastAPI(title="Prostagram API", lifespan=lifespan)
    register_error_handlers(app)
    app.middleware("http")(same_site_only)
    app.middleware("http")(no_store)  # added last = runs first, so every answer gets it, 403s too
    app.include_router(health.router)
    app.include_router(catalog.router)
    app.include_router(projects.router)
    app.include_router(accounts.router)
    return app


app = create_app()
