"""Settings read from environment variables (and backend/.env in development)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # No defaults on purpose: a missing value must stop the app, never fall back to a
    # development database or bucket by accident.
    database_url: str
    r2_account_id: str
    r2_access_key_id: str
    r2_secret_access_key: str
    r2_bucket: str
    # The site people use, e.g. https://projecthouse-pied.vercel.app (no trailing slash). Requests
    # that change data must come from it (Origin check in main.py), and the login cookie is
    # Secure when it starts with https://.
    site_origin: str

    # Optional. Without it GitHub allows 60 requests per hour per server address; a token
    # (no scopes needed for public repos) raises that to 5,000.
    github_api_token: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
