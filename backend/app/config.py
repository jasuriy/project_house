from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings, read from environment variables (DATABASE_URL, CORS_ORIGINS)."""

    database_url: str = (
        "postgresql+asyncpg://projecthouse:projecthouse_dev@localhost:5432/projecthouse"
    )
    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
