"""Builds the FastAPI app: error handlers, routers, caching rule, and clean shutdown."""

from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response

from app import catalog, health
from app.db import engine
from app.errors import register_error_handlers
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


def create_app() -> FastAPI:
    app = FastAPI(title="Prostagram API", lifespan=lifespan)
    register_error_handlers(app)
    app.middleware("http")(no_store)
    app.include_router(health.router)
    app.include_router(catalog.router)
    app.include_router(projects.router)
    return app


app = create_app()
