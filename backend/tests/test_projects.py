"""Project endpoints: temporary uploads, repo preview, creating a project on Render, and the
project page."""

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.db import SessionFactory
from app.projects.models import Project
from tests.fakes import FakeStorage, GitHubRoutes, repo_routes

MB = 1024 * 1024
VIDEO_SIZE = 33_372_331

# The reflex sample (spec section 10), as the upload page sends it on Render (files added below).
REFLEX = {
    "name": "Reflex",
    "short_description": "Web apps in pure Python.",
    "project_type": "library",
    "category": "developer_tools",
    "problem": "Python developers have to learn JavaScript to build a web frontend.",
    "outcome": "Frontend and backend written in Python.",
    "languages": ["Python", "TypeScript", "JavaScript"],
    "tools": ["Starlette", "Granian", "Socket.IO", "Redis", "Radix UI"],
    "deliverables": ["source_code", "package"],
    "license": "Apache-2.0",
    "status": "beta",
    "started_on": "2022-10-25",
    "ongoing": True,
    "repo_url": "https://github.com/reflex-dev/reflex",
}


async def upload(
    client: AsyncClient, storage: FakeStorage, kind: str, content_type: str, size: int
) -> str:
    """The browser's part: ask for a link, then upload to it. Returns the temporary key."""
    ticket = await client.post(
        f"/api/v1/uploads/{kind}/url", json={"content_type": content_type, "size": size}
    )
    assert ticket.status_code == 200, ticket.text
    key = ticket.json()["key"]
    storage.put(key, size, content_type)
    return key


@pytest.fixture
def reflex_repo(github_routes: GitHubRoutes, reflex_readme: str) -> None:
    github_routes.update(repo_routes("reflex-dev", "reflex", reflex_readme))


async def reflex_payload(client: AsyncClient, storage: FakeStorage, poster: bool = True) -> dict:
    video_key = await upload(client, storage, "video", "video/mp4", VIDEO_SIZE)
    payload = {
        **REFLEX,
        "video": {"key": video_key, "file_name": "reflex-demo.mp4", "duration_seconds": 58.56},
    }
    if poster:
        payload["poster_key"] = await upload(client, storage, "poster", "image/jpeg", 500)
    return payload


async def row_count() -> int:
    async with SessionFactory() as session:
        return await session.scalar(select(func.count()).select_from(Project))


def final_keys(storage: FakeStorage) -> list[str]:
    return [k for k in storage.files if not k.startswith("uploads/")]


# --- before Render: temporary uploads and repo preview ----------------------------------------


async def test_upload_link_is_given_only_for_allowed_files(client: AsyncClient) -> None:
    url = "/api/v1/uploads/video/url"

    wrong_type = await client.post(url, json={"content_type": "video/quicktime", "size": 10})
    too_big = await client.post(url, json={"content_type": "video/mp4", "size": 300 * MB + 1})
    allowed = await client.post(url, json={"content_type": "video/mp4", "size": 300 * MB})

    assert wrong_type.json()["error"]["code"] == "upload_type_not_allowed"
    assert too_big.json()["error"]["code"] == "upload_too_large"
    ticket = allowed.json()
    assert ticket["key"].startswith("uploads/")
    assert ticket["key"].endswith("/video.mp4")
    assert ticket["headers"] == {"Content-Type": "video/mp4"}


async def test_repo_preview_reads_github_and_stores_nothing(
    client: AsyncClient, reflex_repo: None
) -> None:
    response = await client.post(
        "/api/v1/repos/preview", json={"url": "github.com/reflex-dev/reflex.git"}
    )

    body = response.json()
    assert body["html_url"] == "https://github.com/reflex-dev/reflex"
    assert body["entries"][0] == {"name": "docs", "type": "dir"}
    assert body["readme_lines"][1] == "# Introduction"
    assert await row_count() == 0


async def test_repo_preview_errors(client: AsyncClient, github_routes: GitHubRoutes) -> None:
    url = "/api/v1/repos/preview"
    github_routes["/repos/down/repo"] = httpx.Response(500)

    bad_url = await client.post(url, json={"url": "https://gitlab.com/a/b"})
    not_found = await client.post(url, json={"url": "https://github.com/nobody/nothing"})
    github_down = await client.post(url, json={"url": "https://github.com/down/repo"})

    assert bad_url.json()["error"]["code"] == "repo_url_invalid"
    assert not_found.json()["error"]["code"] == "repo_not_found"
    assert github_down.status_code == 502


# --- Render ------------------------------------------------------------------------------------


async def test_render_moves_the_files_and_writes_one_row(
    client: AsyncClient, storage: FakeStorage, reflex_repo: None
) -> None:
    payload = await reflex_payload(client, storage)

    response = await client.post("/api/v1/projects", json=payload)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["slug"] == "reflex"
    assert body["published_at"] is not None
    assert body["video"]["size"] == VIDEO_SIZE
    assert body["video"]["duration_seconds"] == 58.56
    assert body["repo"]["full_name"] == "reflex-dev/reflex"
    assert await row_count() == 1
    # Copied out of the temporary folder under the project's id; the originals are gone.
    assert sorted(k.split("/")[0] for k in final_keys(storage)) == ["posters", "videos"]
    assert all(f"/{body['id']}/" in k for k in final_keys(storage))
    assert payload["video"]["key"] in storage.deleted
    assert payload["poster_key"] in storage.deleted


async def test_incomplete_project_is_refused_with_everything_missing(
    client: AsyncClient, storage: FakeStorage
) -> None:
    response = await client.post("/api/v1/projects", json={"name": "Reflex", "problem": "   "})

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "project_incomplete"
    assert error["message"] == (
        "Missing: short_description, project_type, category, problem, outcome, "
        "license, status, languages, tools, deliverables, video"
    )
    assert await row_count() == 0
    assert final_keys(storage) == []


async def test_bad_values_are_refused(client: AsyncClient) -> None:
    for bad in (
        {"category": "cooking"},
        # removed fields (D29): the form no longer has them
        {"post_languages": ["en"]},
        {"getting_started": "uv run reflex run"},
        {"requirements": "Python 3.11+"},
        {"limitations": "none"},
        {"name": "x" * 81},
        {"tools": ["x" * 41]},
        {"languages": [f"lang{i}" for i in range(8)]},  # at most 7 (D26)
        {"tools": [f"tool{i}" for i in range(6)]},  # at most 5 (D26)
        {"video_key": "videos/someone-else.mp4"},  # not a field of the form
    ):
        response = await client.post("/api/v1/projects", json={**REFLEX, **bad})
        assert response.status_code == 422, bad
        assert response.json()["error"]["code"] == "validation_error"


async def test_dates_must_make_sense(
    client: AsyncClient, storage: FakeStorage, reflex_repo: None
) -> None:
    payload = await reflex_payload(client, storage)

    before_start = await client.post(
        "/api/v1/projects",
        json={**payload, "ongoing": False, "started_on": "2024-01-01", "finished_on": "2023-01-01"},
    )
    ongoing_with_end = await client.post(
        "/api/v1/projects", json={**payload, "finished_on": "2024-01-01"}
    )

    assert before_start.json()["error"]["code"] == "invalid_dates"
    assert ongoing_with_end.json()["error"]["code"] == "invalid_dates"
    assert await row_count() == 0


async def test_video_key_not_handed_out_by_this_api_is_refused(
    client: AsyncClient, storage: FakeStorage, reflex_repo: None
) -> None:
    storage.put("videos/other-project/x.mp4", 10, "video/mp4")  # someone's published video

    response = await client.post(
        "/api/v1/projects", json={**REFLEX, "video": {"key": "videos/other-project/x.mp4"}}
    )

    assert response.json()["error"]["code"] == "upload_key_invalid"
    assert await row_count() == 0


async def test_video_that_never_reached_r2_is_refused(
    client: AsyncClient, storage: FakeStorage, reflex_repo: None
) -> None:
    key = "uploads/" + "a" * 32 + "/video.mp4"

    response = await client.post("/api/v1/projects", json={**REFLEX, "video": {"key": key}})

    assert response.json()["error"]["code"] == "upload_missing"
    assert await row_count() == 0


async def test_project_without_a_valid_first_frame_is_saved_without_it(
    client: AsyncClient, storage: FakeStorage, reflex_repo: None
) -> None:
    payload = await reflex_payload(client, storage, poster=False)
    payload["poster_key"] = "uploads/" + "b" * 32 + "/poster.jpg"  # never uploaded

    response = await client.post("/api/v1/projects", json=payload)

    assert response.status_code == 201
    assert response.json()["video"]["poster_url"] is None


async def test_project_without_a_repository_is_saved_without_one(
    client: AsyncClient, storage: FakeStorage
) -> None:
    # The repository is optional (D25): no link, so GitHub is never asked (no routes are set).
    payload = await reflex_payload(client, storage)
    del payload["repo_url"]

    response = await client.post("/api/v1/projects", json=payload)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["repo_url"] is None
    assert body["repo"] is None
    assert await row_count() == 1


async def test_github_down_at_render_leaves_nothing_behind(
    client: AsyncClient, storage: FakeStorage, github_routes: GitHubRoutes
) -> None:
    payload = await reflex_payload(client, storage)
    github_routes["/repos/reflex-dev/reflex"] = httpx.Response(500)

    response = await client.post("/api/v1/projects", json=payload)

    assert response.status_code == 502
    assert await row_count() == 0
    assert final_keys(storage) == []
    assert payload["video"]["key"] in storage.files  # kept, so Render can be pressed again


async def test_same_name_gets_the_next_free_address(
    client: AsyncClient, storage: FakeStorage, reflex_repo: None
) -> None:
    first = await client.post("/api/v1/projects", json=await reflex_payload(client, storage))

    second = await client.post("/api/v1/projects", json=await reflex_payload(client, storage))

    assert first.json()["slug"] == "reflex"
    assert second.json()["slug"] == "reflex-2"
    assert await row_count() == 2


async def test_uzbek_name_gets_a_clean_address(
    client: AsyncClient, storage: FakeStorage, reflex_repo: None
) -> None:
    payload = {**await reflex_payload(client, storage), "name": "O'zbek tili yordamchisi"}

    response = await client.post("/api/v1/projects", json=payload)

    assert response.json()["slug"] == "ozbek-tili-yordamchisi"


async def test_tech_names_take_the_catalog_spelling(
    client: AsyncClient, storage: FakeStorage, reflex_repo: None
) -> None:
    payload = {
        **await reflex_payload(client, storage),
        "languages": ["python", "Python", "TYPESCRIPT"],
        "tools": ["REDIS", "mytool", "MyTool"],
    }

    body = (await client.post("/api/v1/projects", json=payload)).json()

    assert body["languages"] == ["Python", "TypeScript"]
    assert body["tools"] == ["Redis", "mytool"]  # unknown names keep the first spelling


# --- project page -------------------------------------------------------------------------------


async def test_project_is_found_by_its_address_with_fresh_links(
    client: AsyncClient, storage: FakeStorage, reflex_repo: None
) -> None:
    await client.post("/api/v1/projects", json=await reflex_payload(client, storage))

    page = await client.get("/api/v1/projects/by-slug/reflex")
    links = await client.get("/api/v1/projects/by-slug/reflex/video")

    assert page.status_code == 200
    assert page.json()["name"] == "Reflex"
    assert page.json()["video"]["url"].startswith("https://r2.test/download/videos/")
    assert links.json()["url"].startswith("https://r2.test/download/videos/")


async def test_unknown_address_is_not_found(client: AsyncClient) -> None:
    response = await client.get("/api/v1/projects/by-slug/nothing-here")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_found"


async def test_api_answers_are_never_cached(client: AsyncClient) -> None:
    response = await client.get("/api/v1/projects/by-slug/nothing-here")

    assert response.headers["cache-control"] == "no-store"


# --- feed --------------------------------------------------------------------------------------


async def test_feed_lists_newest_first_with_filters_and_search(
    client: AsyncClient, storage: FakeStorage, reflex_repo: None
) -> None:
    first = await client.post("/api/v1/projects", json=await reflex_payload(client, storage))
    second_payload = {
        **await reflex_payload(client, storage, poster=False),
        "name": "Speech 100% notes",
        "short_description": "Transcripts for Uzbek audio.",
        "category": "ai_ml",
        "repo_url": None,
    }
    second = await client.post("/api/v1/projects", json=second_payload)
    assert first.status_code == second.status_code == 201

    feed = (await client.get("/api/v1/projects")).json()["items"]
    assert [p["slug"] for p in feed] == ["speech-100-notes", "reflex"]  # newest first
    assert feed[1]["poster_url"].startswith("https://r2.test/download/posters/")
    assert feed[0]["poster_url"] is None
    assert feed[0]["preview_url"] is None  # made after Render, by the preview job
    assert set(feed[1]) == {
        "slug",
        "name",
        "short_description",
        "project_type",
        "category",
        "status",
        "languages",
        "tools",
        "poster_url",
        "preview_url",
        "published_at",
    }

    by_category = (await client.get("/api/v1/projects", params={"category": "ai_ml"})).json()
    assert [p["slug"] for p in by_category["items"]] == ["speech-100-notes"]
    by_text = (await client.get("/api/v1/projects", params={"q": "PURE python"})).json()
    assert [p["slug"] for p in by_text["items"]] == ["reflex"]
    by_tech = (await client.get("/api/v1/projects", params={"q": "redis"})).json()
    assert [p["slug"] for p in by_tech["items"]] == ["speech-100-notes", "reflex"]  # both use Redis
    literal = (await client.get("/api/v1/projects", params={"q": "100%"})).json()
    assert [p["slug"] for p in literal["items"]] == ["speech-100-notes"]
    none = (await client.get("/api/v1/projects", params={"q": "1%0"})).json()
    assert none["items"] == []  # % typed by the person is not a wildcard

    bad = await client.get("/api/v1/projects", params={"category": "cooking"})
    assert bad.status_code == 422
