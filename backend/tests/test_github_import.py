"""GitHub import (POST /api/v1/me/projects/import), the ownership rule and the GitHub client."""

import httpx
import pytest

from app.projects.github import (
    GitHubClient,
    GitHubUnavailable,
    RepoNotFound,
    get_github,
    parse_github_url,
)
from tests.github_fake import OCTOCAT, STRANGER, connect_github, repo
from tests.media_helpers import signup

pytest_plugins = ["tests.auth_fixtures", "tests.github_fixtures"]

IMPORT = "/api/v1/me/projects/import"


def _code(response) -> str:
    return response.json()["error"]["code"]


# ---- link normalisation ------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("github.com/a/b", ("a", "b")),
        ("https://www.github.com/A/B/", ("A", "B")),
        ("https://github.com/a/b.git", ("a", "b")),
        ("https://github.com/a/b/tree/main", ("a", "b")),
        ("https://github.com/a/b#readme", ("a", "b")),
        ("http://github.com/a/b?tab=readme", ("a", "b")),
        ("https://gitlab.com/a/b", None),
        ("https://github.com/a", None),
        ("https://github.com/../..", None),
        ("https://github.com:8443/a/b", None),
        ("javascript:alert(1)", None),
        ("", None),
    ],
)
def test_link_normalisation(url, expected):
    assert parse_github_url(url) == expected


# ---- the import endpoint -----------------------------------------------------------------------


async def test_import_own_repo_prefills(auth_client, db_session, github):
    await signup(auth_client)
    await connect_github(db_session)
    github.add(
        repo(homepage="https://hello.example.com", license_spdx="MIT"),
        languages={"Shell": 10, "Python": 900, "Go": 300, "C": 50, "Rust": 5, "Ruby": 1},
    )
    r = await auth_client.post(IMPORT, json={"github_url": "github.com/octocat/hello-world"})
    assert r.status_code == 200, r.text
    assert r.json() == {
        "title": "Hello-World",
        "short_description": "My first repository on GitHub!",
        "tech_stack": ["Python", "Go", "C", "Shell", "Rust"],
        "live_url": "https://hello.example.com",
        "github_url": "https://github.com/octocat/Hello-World",
        "license": "MIT",
        "relation": "owner",
        "github_login": "octocat",
    }


async def test_import_contributor_repo(auth_client, db_session, github):
    await signup(auth_client)
    await connect_github(db_session)
    github.add(
        repo("apache", "superset", owner_id=STRANGER), contributors={OCTOCAT: "octocat", 7: "x"}
    )
    r = await auth_client.post(IMPORT, json={"github_url": "https://github.com/apache/superset"})
    assert (r.status_code, r.json()["relation"], r.json()["github_login"]) == (
        200,
        "contributor",
        "octocat",
    )


async def test_import_someone_elses_repo_is_refused(auth_client, db_session, github):
    await signup(auth_client)
    await connect_github(db_session)
    github.add(repo("apache", "superset", owner_id=STRANGER), contributors={7: "x"})
    r = await auth_client.post(IMPORT, json={"github_url": "https://github.com/apache/superset"})
    assert (r.status_code, _code(r)) == (422, "not_your_repo")


async def test_import_copied_fork_is_refused_but_a_fork_with_own_commits_passes(
    auth_client, db_session, github
):
    await signup(auth_client)
    await connect_github(db_session)
    github.add(repo("octocat", "superset", fork=True), contributors={7: "x"})
    github.add(repo("octocat", "worked-fork", fork=True), contributors={OCTOCAT: "octocat"})
    copied = await auth_client.post(IMPORT, json={"github_url": "github.com/octocat/superset"})
    worked = await auth_client.post(IMPORT, json={"github_url": "github.com/octocat/worked-fork"})
    assert (copied.status_code, _code(copied)) == (422, "not_your_repo")
    assert worked.json()["relation"] == "contributor"


async def test_import_without_github_connected(auth_client, github):
    await signup(auth_client)
    github.add(repo())
    r = await auth_client.post(IMPORT, json={"github_url": "github.com/octocat/Hello-World"})
    assert (r.status_code, _code(r)) == (422, "github_not_connected")


async def test_import_missing_or_private_repo(auth_client, db_session, github):
    await signup(auth_client)
    await connect_github(db_session)
    r = await auth_client.post(IMPORT, json={"github_url": "github.com/octocat/nope"})
    assert (r.status_code, _code(r)) == (422, "github_repo_not_found")


async def test_import_github_down_or_rate_limited(auth_client, db_session, github):
    await signup(auth_client)
    await connect_github(db_session)
    github.add(repo())
    github.down = True
    r = await auth_client.post(IMPORT, json={"github_url": "github.com/octocat/Hello-World"})
    assert (r.status_code, _code(r)) == (503, "github_unavailable")


async def test_import_when_contributors_cannot_be_listed_uses_the_owner_rule(
    auth_client, db_session, github
):
    await signup(auth_client)
    await connect_github(db_session)
    github.add(repo(), contributors=None)
    github.add(repo("torvalds", "linux", owner_id=STRANGER), contributors=None)
    own = await auth_client.post(IMPORT, json={"github_url": "github.com/octocat/Hello-World"})
    other = await auth_client.post(IMPORT, json={"github_url": "github.com/torvalds/linux"})
    assert own.json()["relation"] == "owner"
    assert (other.status_code, _code(other)) == (422, "not_your_repo")


async def test_import_prefill_respects_the_form_limits(auth_client, db_session, github):
    await signup(auth_client)
    await connect_github(db_session)
    github.add(
        repo(name="x" * 100, description="d" * 1500, homepage="ftp://files.example.com"),
        languages={"L" * 40: 1},
    )
    body = (
        await auth_client.post(IMPORT, json={"github_url": f"github.com/octocat/{'x' * 100}"})
    ).json()
    assert (len(body["title"]), len(body["short_description"]), body["live_url"]) == (80, 1000, "")
    assert body["tech_stack"] == ["L" * 30]
    github.add(repo(name="long-home", homepage="https://example.com/" + "p" * 300))
    body = (
        await auth_client.post(IMPORT, json={"github_url": "github.com/octocat/long-home"})
    ).json()
    assert body["live_url"] == ""


async def test_import_bad_link_spends_no_github_call(auth_client, db_session, github):
    await signup(auth_client)
    await connect_github(db_session)
    r = await auth_client.post(IMPORT, json={"github_url": "https://gitlab.com/a/b"})
    assert (r.status_code, _code(r), github.calls) == (422, "invalid_github_url", 0)


async def test_import_is_for_developers(auth_client, github):
    await signup(auth_client, account_type="company")
    r = await auth_client.post(IMPORT, json={"github_url": "github.com/octocat/Hello-World"})
    assert (r.status_code, _code(r)) == (403, "developers_only")


# ---- the client against recorded response shapes (no network) ----------------------------------


def client_for(handler) -> GitHubClient:
    transport = httpx.MockTransport(handler)
    return GitHubClient(
        httpx.AsyncClient(
            transport=transport, base_url="https://api.github.com", follow_redirects=True
        )
    )


REPO_JSON = {
    "name": "Hello-World",
    "html_url": "https://github.com/octocat/Hello-World",
    "fork": False,
    "description": "My first repository on GitHub!",
    "homepage": "",
    "license": None,
    "owner": {"login": "octocat", "id": OCTOCAT},
}


async def test_client_reads_a_repo_and_follows_a_rename():
    def handler(request):
        if request.url.path == "/repos/octocat/old-name":
            return httpx.Response(
                301, headers={"location": "https://api.github.com/repos/octocat/Hello-World"}
            )
        return httpx.Response(200, json={**REPO_JSON, "license": {"spdx_id": "MIT"}})

    info = await client_for(handler).repo("octocat", "old-name")
    assert (info.owner_id, info.html_url, info.license_spdx) == (
        OCTOCAT,
        "https://github.com/octocat/Hello-World",
        "MIT",
    )


@pytest.mark.parametrize(
    ("status", "headers", "outcome"),
    [
        (404, {}, RepoNotFound),
        (403, {"x-ratelimit-remaining": "0"}, GitHubUnavailable),
        (429, {}, GitHubUnavailable),
        (502, {}, GitHubUnavailable),
    ],
)
async def test_client_repo_failures(status, headers, outcome):
    with pytest.raises(outcome):
        await client_for(lambda r: httpx.Response(status, headers=headers, json={})).repo("a", "b")


async def test_client_timeout_is_unavailable():
    def handler(request):
        raise httpx.ConnectTimeout("slow", request=request)

    with pytest.raises(GitHubUnavailable):
        await client_for(handler).repo("a", "b")


@pytest.mark.parametrize(
    ("status", "body", "expected"),
    [
        (200, [{"login": "octocat", "id": OCTOCAT, "type": "User"}], {OCTOCAT: "octocat"}),
        (204, None, {}),
        (
            403,
            {"message": "The history or contributor list is too large to list contributors for this repository via the API."},
            None,
        ),
    ],
)
async def test_client_contributors(status, body, expected):
    def handler(request):
        assert request.url.params["per_page"] == "100"
        return httpx.Response(status, json=body) if body is not None else httpx.Response(status)

    assert await client_for(handler).contributors("a", "b") == expected


async def _authorization_header_sent(monkeypatch, token: str) -> str | None:
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "github_api_token", token)
    seen: list[str | None] = []

    def handler(request):
        seen.append(request.headers.get("authorization"))
        return httpx.Response(200, json=REPO_JSON)

    dependency = get_github()
    client = await dependency.__anext__()
    client._http._transport = httpx.MockTransport(handler)
    await client.repo("octocat", "Hello-World")
    await dependency.aclose()
    return seen[0]


async def test_client_sends_the_server_token_only_when_set(monkeypatch):
    assert await _authorization_header_sent(monkeypatch, "") is None
    assert await _authorization_header_sent(monkeypatch, "srv-token") == "Bearer srv-token"


async def test_client_contributors_secondary_rate_limit_is_unavailable():
    # A 403 that is not "too large" (GitHub's secondary rate limit leaves calls remaining) must not
    # turn into "not your repo".
    def handler(request):
        return httpx.Response(
            403,
            headers={"x-ratelimit-remaining": "50", "retry-after": "60"},
            json={"message": "You have exceeded a secondary rate limit."},
        )

    with pytest.raises(GitHubUnavailable):
        await client_for(handler).contributors("a", "b")
