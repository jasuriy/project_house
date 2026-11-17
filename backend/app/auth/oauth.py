"""Google and GitHub through Authlib's Starlette client.

Google uses OpenID Connect discovery: Authlib validates the ID token (signature, issuer,
audience, expiry, nonce) and `email_verified` comes from it. GitHub is plain OAuth 2: the profile
email is often null or private, so the email comes from `/user/emails` (primary AND verified).
"""

from functools import lru_cache

from authlib.integrations.starlette_client import OAuth
from authlib.integrations.starlette_client.apps import StarletteOAuth2App

from app.auth.service import OAuthProfile
from app.core.config import get_settings
from app.core.errors import AppError

GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"


@lru_cache
def _registry(google: tuple[str, str], github: tuple[str, str]) -> OAuth:
    """One registry per credential set, kept for the process: the clients cache Google's
    discovery document and signing keys, which must not be refetched on every login."""
    oauth = OAuth()
    if all(google):
        oauth.register(
            "google",
            client_id=google[0],
            client_secret=google[1],
            server_metadata_url=GOOGLE_DISCOVERY_URL,
            client_kwargs={"scope": "openid email profile", "code_challenge_method": "S256"},
        )
    if all(github):
        oauth.register(
            "github",
            client_id=github[0],
            client_secret=github[1],
            authorize_url="https://github.com/login/oauth/authorize",
            access_token_url="https://github.com/login/oauth/access_token",
            api_base_url="https://api.github.com/",
            client_kwargs={"scope": "read:user user:email"},
        )
    return oauth


def get_oauth_client(provider: str) -> StarletteOAuth2App:
    """FastAPI dependency: the client for `provider`, or 404 `provider_disabled` when the name is
    unknown or its client id or secret is empty."""
    settings = get_settings()
    registry = _registry(
        (settings.google_client_id, settings.google_client_secret),
        (settings.github_client_id, settings.github_client_secret),
    )
    client = registry.create_client(provider)
    if client is None:
        raise AppError(404, "provider_disabled", "This sign-in provider is not enabled")
    return client


def _clean(value: str | None) -> str | None:
    """Provider-controlled text goes into PostgreSQL text columns, which cannot hold NUL."""
    return value.replace("\x00", "") if value else value


def _clean_email(value: str | None) -> str | None:
    """An email with a NUL byte is not an address the provider verified (the repaired value
    would be a different one), so it is dropped, not stripped."""
    return None if value is None or "\x00" in value else value


async def fetch_profile(provider: str, client: StarletteOAuth2App, token: dict) -> OAuthProfile:
    """The signed-in provider account. Raises on any malformed or failed provider response."""
    if provider == "google":
        info = token["userinfo"]  # parsed and validated from the ID token by Authlib
        email = _clean_email(info.get("email"))
        return OAuthProfile(
            provider_user_id=info["sub"],
            email=email,
            email_verified=info.get("email_verified") is True,
            username_hint=email.split("@")[0] if email else "",
            display_name=_clean(info.get("name")),
        )
    user_response = await client.get("user", token=token)
    user_response.raise_for_status()
    user = user_response.json()
    emails_response = await client.get("user/emails", token=token)
    emails_response.raise_for_status()
    primary = next(
        (
            e
            for e in emails_response.json()
            if e.get("primary") is True and e.get("verified") is True
        ),
        None,
    )
    email = _clean_email(primary["email"]) if primary else None
    return OAuthProfile(
        provider_user_id=str(user["id"]),
        email=email,
        email_verified=email is not None,
        username_hint=_clean(user.get("login")) or "",
        display_name=_clean(user.get("name")),
    )
