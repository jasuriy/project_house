from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.auth import router as auth
from app.auth.csrf import OriginCheckMiddleware
from app.core.cache import NoStoreApiMiddleware
from app.core.config import get_settings
from app.core.db import dispose_engine
from app.core.errors import register_error_handlers
from app.health import router as health
from app.media import router as media_router
from app.projects import router as projects
from app.social import router as social
from app.users import router as users


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await dispose_engine()


def create_app() -> FastAPI:
    app = FastAPI(title="Project House", lifespan=lifespan)
    # Outermost first: CORS, Origin check (rejects before cookies are read), OAuth-state session.
    app.add_middleware(
        SessionMiddleware,
        secret_key=get_settings().secret_key,
        session_cookie="ph_oauth",
        max_age=600,
        path="/api/v1/auth/oauth",
        same_site="lax",
        https_only=get_settings().app_env == "production",
    )
    app.add_middleware(OriginCheckMiddleware)
    app.add_middleware(NoStoreApiMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)
    app.include_router(health.router, prefix="/api")
    app.include_router(users.router, prefix="/api/v1")
    app.include_router(projects.router, prefix="/api/v1")
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(media_router.router, prefix="/api/v1")
    app.include_router(social.router, prefix="/api/v1")
    return app


app = create_app()
