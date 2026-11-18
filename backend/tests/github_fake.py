"""A stand-in for GitHub in tests (no network). Shapes follow real responses recorded from
api.github.com on 2026-11-18 [V]:

- GET /users/octocat -> id 583231, login "octocat"
- GET /repos/octocat/Hello-World -> 200, owner.id 583231, fork false, homepage "", license null,
  html_url "https://github.com/octocat/Hello-World"
- GET /repos/octocat/Hello-World/languages -> 200 {}
- GET /repos/octocat/Hello-World/contributors -> 200 [{login, id, type: "User"}, ...]
- GET /repos/octocat/<missing> -> 404 {"message": "Not Found", ...}
- GET /repos/OCTOCAT/hello-world -> 200 with full_name "octocat/Hello-World" (paths ignore case)
- headers: x-ratelimit-limit 60, x-ratelimit-remaining, x-ratelimit-used, x-ratelimit-reset

Not observed (from GitHub's documentation) [A]: rate-limited 403/429 with remaining "0"; renamed
repositories answer 301; an empty repository's contributors answer 204; a very large one 403.
"""

from app.projects.github import GitHubUnavailable, RepoInfo, RepoNotFound

OCTOCAT = 583231
STRANGER = 1


def repo(
    owner: str = "octocat", name: str = "Hello-World", *, owner_id: int = OCTOCAT, **extra
) -> RepoInfo:
    fields = {
        "owner_id": owner_id,
        "owner_login": owner,
        "name": name,
        "html_url": f"https://github.com/{owner}/{name}",
        "fork": False,
        "description": "My first repository on GitHub!",
        "homepage": "",
        "license_spdx": None,
    }
    fields.update(extra)
    return RepoInfo(**fields)


class FakeGitHub:
    """`repos` maps lowercase (owner, name) to a RepoInfo; `contributors` to {id: login} or None;
    `down` makes every call fail like an unavailable GitHub. `calls` counts requests."""

    def __init__(self) -> None:
        self.repos: dict[tuple[str, str], RepoInfo] = {}
        self.contributor_map: dict[tuple[str, str], dict[int, str] | None] = {}
        self.language_map: dict[tuple[str, str], dict[str, int]] = {}
        self.down = False
        self.calls = 0

    def add(self, info: RepoInfo, *, contributors=None, languages=None) -> None:
        key = (info.owner_login.lower(), info.name.lower())
        self.repos[key] = info
        self.contributor_map[key] = {} if contributors is None else contributors
        self.language_map[key] = languages or {}

    def _key(self, owner: str, name: str) -> tuple[str, str]:
        self.calls += 1
        if self.down:
            raise GitHubUnavailable
        return owner.lower(), name.lower()

    async def repo(self, owner: str, name: str) -> RepoInfo:
        key = self._key(owner, name)
        if key not in self.repos:
            raise RepoNotFound
        return self.repos[key]

    async def languages(self, owner: str, name: str) -> dict[str, int]:
        return self.language_map.get(self._key(owner, name), {})

    async def contributors(self, owner: str, name: str) -> dict[int, str] | None:
        return self.contributor_map.get(self._key(owner, name), {})
