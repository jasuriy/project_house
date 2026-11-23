"""Reads a public GitHub repository once, to store a small preview of it.

The preview (root files and the first README lines) is saved with the project, so showing a
project page never calls GitHub (GitHub allows only 60 anonymous requests per hour).
"""

import re
from datetime import UTC, datetime
from functools import lru_cache

import httpx
from pydantic import BaseModel

from app.config import get_settings

REPO_URL = re.compile(
    r"^(?:https?://)?(?:www\.)?github\.com/([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100}?)(?:\.git)?/?$"
)
README_PREVIEW_LINES = 10
MAX_ENTRIES = 100


class RepoEntry(BaseModel):
    name: str
    type: str  # "dir" or "file"


class RepoSnapshot(BaseModel):
    full_name: str
    html_url: str
    description: str | None
    default_branch: str
    entries: list[RepoEntry]
    readme_lines: list[str]
    fetched_at: datetime


class GitHubUnavailable(Exception):
    """GitHub did not answer normally (network error, rate limit, server error)."""


def parse_repo_url(url: str) -> tuple[str, str] | None:
    """'https://github.com/owner/repo' -> ('owner', 'repo'); anything else -> None."""
    match = REPO_URL.match(url.strip())
    return (match.group(1), match.group(2)) if match else None


def readme_preview(text: str) -> list[str]:
    """First meaningful README lines: skips HTML, badges, images, quotes, rules and code."""
    lines: list[str] = []
    in_code = False
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("```"):
            in_code = not in_code
            continue
        if in_code or not line or line.startswith(("<", "[![", "![", ">")):
            continue
        if set(line) <= set("-=*_ "):  # horizontal rules such as --- or ***
            continue
        lines.append(line)
        if len(lines) == README_PREVIEW_LINES:
            break
    return lines


class GitHub:
    def __init__(self, token: str = "", transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.headers = {"Accept": "application/vnd.github+json"}
        if token:
            self.headers["Authorization"] = f"Bearer {token}"
        self.transport = transport  # tests pass a fake transport; None means the real network

    async def fetch_snapshot(self, owner: str, repo: str) -> RepoSnapshot | None:
        """The repo's preview, or None when it does not exist or is not public."""
        async with httpx.AsyncClient(
            base_url="https://api.github.com",
            headers=self.headers,
            transport=self.transport,
            timeout=10,
            follow_redirects=True,  # a renamed repo answers 301 to its new address
        ) as client:
            info = await self._get(client, f"/repos/{owner}/{repo}")
            if info is None or info.json()["private"]:
                return None
            full_name = info.json()["full_name"]  # current name, also after a rename
            contents = await self._get(client, f"/repos/{full_name}/contents")
            readme = await self._get(
                client,
                f"/repos/{full_name}/readme",
                headers={"Accept": "application/vnd.github.raw"},
            )

        data = info.json()
        entries = [
            RepoEntry(name=item["name"], type="dir" if item["type"] == "dir" else "file")
            for item in (contents.json() if contents is not None else [])
        ]
        entries.sort(key=lambda e: (e.type != "dir", e.name.lower()))  # folders first, like GitHub
        return RepoSnapshot(
            full_name=data["full_name"],
            html_url=data["html_url"],
            description=data["description"],
            default_branch=data["default_branch"],
            entries=entries[:MAX_ENTRIES],
            readme_lines=readme_preview(readme.text) if readme is not None else [],
            fetched_at=datetime.now(UTC),
        )

    @staticmethod
    async def _get(
        client: httpx.AsyncClient, path: str, headers: dict[str, str] | None = None
    ) -> httpx.Response | None:
        """The response, None for 404, GitHubUnavailable for anything else that is not 200."""
        try:
            response = await client.get(path, headers=headers)
        except httpx.HTTPError as exc:
            raise GitHubUnavailable(str(exc)) from exc
        if response.status_code == 404:
            return None
        if response.status_code != 200:
            raise GitHubUnavailable(f"GitHub answered {response.status_code} for {path}")
        return response


@lru_cache
def get_github() -> GitHub:
    return GitHub(token=get_settings().github_api_token)
