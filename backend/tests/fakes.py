"""Stand-ins for the outside world (R2 and GitHub), so tests never use the internet."""

import asyncio
from pathlib import Path

import httpx

from app.github import GitHub
from app.storage import StoredFile


class FakeStorage:
    """Stands in for R2: remembers "uploaded" files in a dict."""

    def __init__(self) -> None:
        self.files: dict[str, StoredFile] = {}
        self.deleted: list[str] = []
        self.uploaded: dict[str, bytes] = {}  # files the backend itself wrote (upload_file)
        self.fail_deletes = False  # set True to act like R2 being unreachable

    def put(self, key: str, size: int, content_type: str) -> None:
        """What the browser's upload to the signed link would do."""
        self.files[key] = StoredFile(size=size, content_type=content_type)

    def presign_put(self, key: str, content_type: str, size: int) -> str:
        return f"https://r2.test/upload/{key}"

    def presign_get(self, key: str) -> str:
        return f"https://r2.test/download/{key}"

    async def head(self, key: str) -> StoredFile | None:
        return self.files.get(key)

    async def copy(self, source: str, target: str) -> None:
        self.files[target] = self.files[source]

    async def upload_file(self, path: str, key: str, content_type: str) -> None:
        # Read now: the caller deletes its temporary file right after, as with R2.
        data = await asyncio.to_thread(Path(path).read_bytes)
        self.files[key] = StoredFile(size=len(data), content_type=content_type)
        self.uploaded[key] = data

    async def delete(self, key: str) -> None:
        if self.fail_deletes:
            raise ConnectionError("R2 is unreachable")
        self.files.pop(key, None)
        self.deleted.append(key)


GitHubRoutes = dict[str, httpx.Response]


def fake_github(routes: GitHubRoutes) -> GitHub:
    """A real GitHub client whose requests are answered from `routes` (path -> response)."""

    def answer(request: httpx.Request) -> httpx.Response:
        return routes.get(request.url.path, httpx.Response(404))

    return GitHub(transport=httpx.MockTransport(answer))


def repo_routes(owner: str, repo: str, readme: str, private: bool = False) -> GitHubRoutes:
    """GitHub's answers for one repository."""
    base = f"/repos/{owner}/{repo}"
    return {
        base: httpx.Response(
            200,
            json={
                "full_name": f"{owner}/{repo}",
                "html_url": f"https://github.com/{owner}/{repo}",
                "description": "Web apps in pure Python.",
                "default_branch": "main",
                "private": private,
            },
        ),
        f"{base}/contents": httpx.Response(
            200,
            json=[
                {"name": "README.md", "type": "file"},
                {"name": "reflex", "type": "dir"},
                {"name": "pyproject.toml", "type": "file"},
                {"name": "docs", "type": "dir"},
            ],
        ),
        f"{base}/readme": httpx.Response(200, text=readme),
    }
