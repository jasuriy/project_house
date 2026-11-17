from functools import lru_cache
from typing import Literal, Self

from pydantic import model_validator
from pydantic_settings import BaseSettings

DEV_DATABASE_URL = "postgresql+asyncpg://projecthouse:projecthouse_dev@127.0.0.1:55432/projecthouse"
DEV_SECRET_KEY = "dev-only-change-me"  # public placeholder; production requires its own key
MIN_PRODUCTION_SECRET_LENGTH = 32


class Settings(BaseSettings):
    """Application settings, read from environment variables.

    `database_url` and `secret_key` have a dev default only outside production; in production
    an empty or missing value fails at startup, so a dev default can never reach production.
    """

    app_env: Literal["development", "test", "production"] = "development"
    database_url: str = ""
    secret_key: str = ""
    public_base_url: str = "http://localhost:3000"
    cors_origins: list[str] = ["http://localhost:3000"]

    @model_validator(mode="after")
    def _require_or_default_secrets(self) -> Self:
        if self.app_env == "production":
            if not self.database_url:
                raise ValueError("DATABASE_URL is required when APP_ENV=production")
            if len(self.secret_key) < MIN_PRODUCTION_SECRET_LENGTH:
                raise ValueError(
                    f"SECRET_KEY is required when APP_ENV=production "
                    f"(at least {MIN_PRODUCTION_SECRET_LENGTH} characters)"
                )
            return self
        self.database_url = self.database_url or DEV_DATABASE_URL
        self.secret_key = self.secret_key or DEV_SECRET_KEY
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
