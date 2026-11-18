"""GitHub's public REST API, read only, and the repository ownership rule (add-project design,
part 2). The user's own GitHub token is never stored or used: the login reads the profile once.

Response shapes recorded from api.github.com on 2026-11-18 (see tests/github_fake.py).
"""

import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Literal
from urllib.parse import urlsplit

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import AuthIdentity
from app.core.config import get_settings
from app.core.errors import AppError

API = "https://api.github.com"
TIMEOUT_S = 10
PART = re.compile(r"[A-Za-z0-9._-]{1,100}")
HOSTS = ("github.com", "www.github.com")


class GitHubUnavailable(Exception):
    """GitHub did not answer usefully: down, slow, rate-limited."""


class RepoNotFound(Exception):
    """No such public repository (private ones answer 404 to an anonymous read)."""


@dataclass(frozen=True)
class RepoInfo:
    owner_id: int
    owner_login: str
    name: str
    html_url: str
    fork: bool
    description: str
    homepage: str
    license_spdx: str | None


class GitHubClient:
    def __init__(self, http: httpx.AsyncClient) -> None:
        self._http = http

    async def _get(self, path: str, **params: object) -> httpx.Response:
        try:
            response = await self._http.get(path, params=params or None)
        except httpx.HTTPError:
            raise GitHubUnavailable from None
        limited = response.headers.get("x-ratelimit-remaining") == "0"
        if response.status_code == 429 or (response.status_code == 403 and limited):
            raise GitHubUnavailable
        if response.status_code >= 500:
            raise GitHubUnavailable
        return response

    async def repo(self, owner: str, name: str) -> RepoInfo:
        response = await self._get(f"/repos/{owner}/{name}")
        if response.status_code == 404:
            raise RepoNotFound
        if response.status_code != 200:
            raise GitHubUnavailable
        data = response.json()
        spdx = (data.get("license") or {}).get("spdx_id")
        return RepoInfo(
            owner_id=int(data["owner"]["id"]),
            owner_login=str(data["owner"]["login"]),
            name=str(data["name"]),
            html_url=str(data["html_url"]),
            fork=bool(data.get("fork")),
            description=str(data.get("description") or ""),
            homepage=str(data.get("homepage") or ""),
            license_spdx=spdx if spdx and spdx != "NOASSERTION" else None,
        )

    async def languages(self, owner: str, name: str) -> dict[str, int]:
        response = await self._get(f"/repos/{owner}/{name}/languages")
        return response.json() if response.status_code == 200 else {}

    async def contributors(self, owner: str, name: str) -> dict[int, str] | None:
        """{user id: login} of the first 100 contributors; None when GitHub will not list them
        (a very large repository answers 403 "too large") [A: message wording from GitHub docs]."""
        response = await self._get(f"/repos/{owner}/{name}/contributors", per_page=100)
        if response.status_code == 204:  # an empty repository
            return {}
        if response.status_code == 403:
            # Only "too large to list" means the list is unavailable for good; any other 403 (a
            # secondary rate limit leaves calls remaining) is GitHub being busy, not "not yours".
            message = str(response.json().get("message", "")) if response.content else ""
            if "too large" in message.lower():
                return None
            raise GitHubUnavailable
        if response.status_code != 200:
            raise GitHubUnavailable
        return {int(c["id"]): str(c.get("login") or "") for c in response.json() if "id" in c}


async def get_github() -> AsyncIterator[GitHubClient]:
    """FastAPI dependency: one HTTP client per request, closed when the request ends."""
    headers = {"User-Agent": "ProjectHouse", "Accept": "application/vnd.github+json"}
    token = get_settings().github_api_token
    if token:
        headers["Authorization"] = f"Bearer {token}"
    async with httpx.AsyncClient(
        base_url=API, headers=headers, timeout=TIMEOUT_S, follow_redirects=True
    ) as http:
        yield GitHubClient(http)


def parse_github_url(url: str) -> tuple[str, str] | None:
    """(owner, repo) from what people paste: with or without https://, www., a trailing / or
    .git, or a deeper page of the repository (/tree/main, #readme). None for anything else."""
    value = (url or "").strip()
    if not value:
        return None
    if "://" not in value:
        value = "https://" + value
    try:
        parts = urlsplit(value)
        port = parts.port
    except ValueError:
        return None
    if (
        parts.scheme not in ("http", "https")
        or port is not None
        or parts.username
        or parts.password
    ):
        return None
    if (parts.hostname or "").lower() not in HOSTS:
        return None
    segments = [s for s in parts.path.split("/") if s]
    if len(segments) < 2:
        return None
    owner, repo = segments[0], segments[1].removesuffix(".git")
    if not all(PART.fullmatch(s) and s.strip(".") for s in (owner, repo)):
        return None
    return owner, repo


def same_repository(a: str | None, b: str | None) -> bool:
    """Two links name the same repository (GitHub paths ignore letter case)."""
    pa, pb = parse_github_url(a or ""), parse_github_url(b or "")
    return (
        pa is not None and pb is not None and tuple(map(str.lower, pa)) == tuple(map(str.lower, pb))
    )


async def github_account(session: AsyncSession, user_id: int) -> int | None:
    """The user's connected GitHub account number, or None."""
    value = await session.scalar(
        select(AuthIdentity.provider_user_id).where(
            AuthIdentity.user_id == user_id, AuthIdentity.provider == "github"
        )
    )
    return int(value) if value and value.isdigit() else None


@dataclass(frozen=True)
class Ownership:
    repo: RepoInfo
    relation: Literal["owner", "contributor"]
    login: str


async def check_ownership(github: GitHubClient, account: int | None, url: str) -> Ownership:
    """The ownership rule: owner of a non-fork repository, or one of its first 100 contributors.
    Every failure is an AppError reported on the github_url field."""
    parsed = parse_github_url(url)
    if parsed is None:
        raise AppError(422, "invalid_github_url", "Not a GitHub repository link")
    if account is None:
        raise AppError(422, "github_not_connected", "Connect your GitHub account first")
    try:
        repo = await github.repo(*parsed)
        if not repo.fork and repo.owner_id == account:
            return Ownership(repo, "owner", repo.owner_login)
        contributors = await github.contributors(*parsed)
    except RepoNotFound:
        raise AppError(422, "github_repo_not_found", "Repository not found or private") from None
    except GitHubUnavailable:
        raise AppError(503, "github_unavailable", "GitHub is not answering, try again") from None
    if contributors and account in contributors:
        return Ownership(repo, "contributor", contributors[account])
    raise AppError(422, "not_your_repo", "This repository is not yours")
