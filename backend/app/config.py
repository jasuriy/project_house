"""Settings read from environment variables (and backend/.env in development)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # No default on purpose: a missing value must stop the app, never fall back to a
    # development database by accident.
    database_url: str


@lru_cache
def get_settings() -> Settings:
    return Settings()
