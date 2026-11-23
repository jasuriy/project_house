"""Builds the FastAPI app: error handlers, routers, and clean shutdown."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import health
from app.db import engine
from app.errors import register_error_handlers


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()  # close pooled database connections on shutdown


def create_app() -> FastAPI:
    app = FastAPI(title="Prostagram API", lifespan=lifespan)
    register_error_handlers(app)
    app.include_router(health.router)
    return app


app = create_app()
