"""Project endpoints: drafts, autosave, uploads, repo preview and publishing."""

import uuid

import httpx
from httpx import AsyncClient

from tests.fakes import FakeStorage, GitHubRoutes, repo_routes

MB = 1024 * 1024

# The reflex sample (spec section 10), as the upload page would send it.
REFLEX = {
    "name": "Reflex",
    "short_description": "Web apps in pure Python.",
    "project_type": "library",
    "category": "developer_tools",
    "post_languages": ["en"],
    "problem": "Python developers have to learn JavaScript to build a web frontend.",
    "outcome": "Frontend and backend written in Python.",
    "audience": "Python developers",
    "languages": ["Python", "TypeScript", "JavaScript"],
    "tools": ["Starlette", "Granian", "Socket.IO", "Redis", "Radix UI"],
    "deliverables": ["source_code", "package"],
    "getting_started": "uv init -> uv add reflex -> uv run reflex init -> uv run reflex run",
    "requirements": "Python 3.11+",
    "license": "Apache-2.0",
    "status": "beta",
    "started_on": "2022-10-25",
    "ongoing": True,
}


async def new_draft(client: AsyncClient) -> str:
    response = await client.post("/api/v1/projects")
    assert response.status_code == 201
    return response.json()["id"]


async def upload(
    client: AsyncClient,
    storage: FakeStorage,
    project_id: str,
    kind: str,
    content_type: str,
    size: int,
) -> dict:
    """The whole upload as the browser does it: ask for a link, upload, report done."""
    ticket = await client.post(
        f"/api/v1/projects/{project_id}/uploads/{kind}/url",
        json={"content_type": content_type, "size": size},
    )
    assert ticket.status_code == 200, ticket.text
    key = ticket.json()["key"]
    storage.put(key, size, content_type)
    done = await client.post(
        f"/api/v1/projects/{project_id}/uploads/{kind}/complete",
        json={"key": key, "file_name": "reflex-demo.mp4", "duration_seconds": 58.56},
    )
    assert done.status_code == 200, done.text
    return done.json()


async def complete_reflex_draft(
    client: AsyncClient, storage: FakeStorage, github_routes: GitHubRoutes, readme: str
) -> str:
    project_id = await new_draft(client)
    assert (await client.patch(f"/api/v1/projects/{project_id}", json=REFLEX)).status_code == 200
    await upload(client, storage, project_id, "video", "video/mp4", 33_372_331)
    github_routes.update(repo_routes("reflex-dev", "reflex", readme))
    repo = await client.post(
        f"/api/v1/projects/{project_id}/repo", json={"url": "https://github.com/reflex-dev/reflex"}
    )
    assert repo.status_code == 200, repo.text
    return project_id


# --- drafts and autosave ---------------------------------------------------------------


async def test_new_draft_is_empty_and_lists_everything_missing(client: AsyncClient) -> None:
    project_id = await new_draft(client)

    body = (await client.get(f"/api/v1/projects/{project_id}")).json()

    assert body["published_at"] is None
    assert body["slug"] is None
    assert body["video"] is None
    assert body["missing_fields"] == [
        "name",
        "short_description",
        "project_type",
        "category",
        "problem",
        "outcome",
        "audience",
        "getting_started",
        "requirements",
        "license",
        "status",
        "post_languages",
        "languages",
        "tools",
        "deliverables",
        "video",
        "repo",
    ]


async def test_unknown_project_is_not_found(client: AsyncClient) -> None:
    response = await client.get(f"/api/v1/projects/{uuid.uuid4()}")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_found"


async def test_autosave_changes_only_the_sent_fields(client: AsyncClient) -> None:
    project_id = await new_draft(client)
    await client.patch(f"/api/v1/projects/{project_id}", json={"name": "  Reflex  "})

    response = await client.patch(
        f"/api/v1/projects/{project_id}", json={"short_description": "Web apps in pure Python."}
    )

    body = response.json()
    assert body["name"] == "Reflex"  # trimmed, and kept by the second save
    assert body["short_description"] == "Web apps in pure Python."
    assert "name" not in body["missing_fields"]


async def test_emptied_text_becomes_missing_again(client: AsyncClient) -> None:
    project_id = await new_draft(client)
    await client.patch(f"/api/v1/projects/{project_id}", json={"name": "Reflex"})

    body = (await client.patch(f"/api/v1/projects/{project_id}", json={"name": "   "})).json()

    assert body["name"] is None
    assert "name" in body["missing_fields"]


async def test_repeated_choices_and_tech_are_kept_once(client: AsyncClient) -> None:
    project_id = await new_draft(client)

    body = (
        await client.patch(
            f"/api/v1/projects/{project_id}",
            json={"post_languages": ["en", "uz", "en"], "tools": ["Redis", " Redis ", "MyTool"]},
        )
    ).json()

    assert body["post_languages"] == ["en", "uz"]
    assert body["tools"] == ["Redis", "MyTool"]  # a typed name outside the catalog is allowed


async def test_typed_tech_names_take_the_catalog_spelling(client: AsyncClient) -> None:
    project_id = await new_draft(client)

    body = (
        await client.patch(
            f"/api/v1/projects/{project_id}",
            json={
                "languages": ["python", "Python", "TYPESCRIPT"],
                "tools": ["REDIS", "mytool", "MyTool"],
            },
        )
    ).json()

    assert body["languages"] == ["Python", "TypeScript"]
    assert body["tools"] == ["Redis", "mytool"]  # unknown names keep the first spelling


async def test_autosave_rejects_bad_values(client: AsyncClient) -> None:
    project_id = await new_draft(client)
    url = f"/api/v1/projects/{project_id}"

    for bad in (
        {"category": "cooking"},
        {"post_languages": ["de"]},
        {"name": "x" * 81},
        {"tools": ["x" * 41]},
        {"video_key": "videos/someone-else.mp4"},  # not a form field
    ):
        response = await client.patch(url, json=bad)
        assert response.status_code == 422, bad
        assert response.json()["error"]["code"] == "validation_error"


async def test_dates_must_make_sense_after_merging(client: AsyncClient) -> None:
    project_id = await new_draft(client)
    url = f"/api/v1/projects/{project_id}"
    await client.patch(url, json={"finished_on": "2023-01-01"})

    before_start = await client.patch(url, json={"started_on": "2024-01-01"})
    ongoing_with_end = await client.patch(url, json={"ongoing": True})

    assert before_start.status_code == 422
    assert before_start.json()["error"]["code"] == "invalid_dates"
    assert ongoing_with_end.status_code == 422
    stored = (await client.get(url)).json()
    assert stored["started_on"] is None  # the rejected change was not saved
    assert stored["ongoing"] is False


# --- uploads -----------------------------------------------------------------------------


async def test_upload_link_is_given_only_for_allowed_files(client: AsyncClient) -> None:
    project_id = await new_draft(client)
    url = f"/api/v1/projects/{project_id}/uploads/video/url"

    wrong_type = await client.post(url, json={"content_type": "video/quicktime", "size": 10})
    too_big = await client.post(url, json={"content_type": "video/mp4", "size": 300 * MB + 1})
    allowed = await client.post(url, json={"content_type": "video/mp4", "size": 300 * MB})

    assert wrong_type.json()["error"]["code"] == "upload_type_not_allowed"
    assert too_big.json()["error"]["code"] == "upload_too_large"
    assert allowed.status_code == 200
    ticket = allowed.json()
    assert ticket["key"].startswith(f"videos/{project_id}/")
    assert ticket["key"].endswith(".mp4")
    assert ticket["headers"] == {"Content-Type": "video/mp4"}


async def test_finished_upload_attaches_the_video(
    client: AsyncClient, storage: FakeStorage
) -> None:
    project_id = await new_draft(client)

    body = await upload(client, storage, project_id, "video", "video/mp4", 33_372_331)

    video = body["video"]
    assert video["url"].startswith("https://r2.test/download/videos/")
    assert video["file_name"] == "reflex-demo.mp4"
    assert video["size"] == 33_372_331
    assert video["duration_seconds"] == 58.56
    assert video["poster_url"] is None
    assert "video" not in body["missing_fields"]


async def test_upload_that_never_reached_r2_is_refused(client: AsyncClient) -> None:
    project_id = await new_draft(client)
    key = f"videos/{project_id}/never-uploaded.mp4"

    response = await client.post(
        f"/api/v1/projects/{project_id}/uploads/video/complete", json={"key": key}
    )

    assert response.json()["error"]["code"] == "upload_missing"


async def test_file_that_breaks_the_rules_is_deleted(
    client: AsyncClient, storage: FakeStorage
) -> None:
    project_id = await new_draft(client)
    key = f"videos/{project_id}/huge.mp4"
    storage.put(key, 400 * MB, "video/mp4")  # bigger than what was signed for

    response = await client.post(
        f"/api/v1/projects/{project_id}/uploads/video/complete", json={"key": key}
    )

    assert response.json()["error"]["code"] == "upload_invalid"
    assert key not in storage.files


async def test_key_of_another_project_is_refused(client: AsyncClient, storage: FakeStorage) -> None:
    project_id = await new_draft(client)
    other_key = f"videos/{uuid.uuid4()}/x.mp4"
    storage.put(other_key, 10, "video/mp4")

    response = await client.post(
        f"/api/v1/projects/{project_id}/uploads/video/complete", json={"key": other_key}
    )

    assert response.json()["error"]["code"] == "upload_key_invalid"


async def test_new_video_replaces_old_video_and_its_first_frame(
    client: AsyncClient, storage: FakeStorage
) -> None:
    project_id = await new_draft(client)
    first = await upload(client, storage, project_id, "video", "video/mp4", 1000)
    with_poster = await upload(client, storage, project_id, "poster", "image/jpeg", 500)
    old_video = first["video"]["url"].removeprefix("https://r2.test/download/")
    old_poster = with_poster["video"]["poster_url"].removeprefix("https://r2.test/download/")

    second = await upload(client, storage, project_id, "video", "video/webm", 2000)

    assert second["video"]["content_type"] == "video/webm"
    assert second["video"]["poster_url"] is None
    assert old_video in storage.deleted
    assert old_poster in storage.deleted


async def test_new_video_is_kept_even_if_the_old_one_cannot_be_deleted(
    client: AsyncClient, storage: FakeStorage
) -> None:
    project_id = await new_draft(client)
    await upload(client, storage, project_id, "video", "video/mp4", 1000)
    storage.fail_deletes = True

    body = await upload(client, storage, project_id, "video", "video/webm", 2000)

    assert body["video"]["content_type"] == "video/webm"  # saved; the old file is left behind


async def test_first_frame_needs_a_video(client: AsyncClient, storage: FakeStorage) -> None:
    project_id = await new_draft(client)
    key = f"posters/{project_id}/frame.jpg"
    storage.put(key, 500, "image/jpeg")

    response = await client.post(
        f"/api/v1/projects/{project_id}/uploads/poster/complete", json={"key": key}
    )

    assert response.json()["error"]["code"] == "video_missing"


# --- repository preview -------------------------------------------------------------------


async def test_linking_a_repo_stores_its_preview(
    client: AsyncClient, github_routes: GitHubRoutes, reflex_readme: str
) -> None:
    project_id = await new_draft(client)
    github_routes.update(repo_routes("reflex-dev", "reflex", reflex_readme))

    response = await client.post(
        f"/api/v1/projects/{project_id}/repo", json={"url": "github.com/reflex-dev/reflex.git"}
    )

    body = response.json()
    assert body["repo_url"] == "https://github.com/reflex-dev/reflex"
    assert body["repo"]["full_name"] == "reflex-dev/reflex"
    assert body["repo"]["entries"][0] == {"name": "docs", "type": "dir"}
    assert body["repo"]["readme_lines"][1] == "# Introduction"
    assert "repo" not in body["missing_fields"]


async def test_repo_link_errors(client: AsyncClient, github_routes: GitHubRoutes) -> None:
    project_id = await new_draft(client)
    url = f"/api/v1/projects/{project_id}/repo"
    github_routes["/repos/down/repo"] = httpx.Response(500)

    bad_url = await client.post(url, json={"url": "https://gitlab.com/a/b"})
    not_found = await client.post(url, json={"url": "https://github.com/nobody/nothing"})
    github_down = await client.post(url, json={"url": "https://github.com/down/repo"})

    assert bad_url.json()["error"]["code"] == "repo_url_invalid"
    assert not_found.json()["error"]["code"] == "repo_not_found"
    assert github_down.status_code == 502
    assert github_down.json()["error"]["code"] == "github_unavailable"


# --- publishing ------------------------------------------------------------------------------


async def test_incomplete_draft_cannot_be_published(client: AsyncClient) -> None:
    project_id = await new_draft(client)
    await client.patch(f"/api/v1/projects/{project_id}", json={"name": "Reflex"})

    response = await client.post(f"/api/v1/projects/{project_id}/publish")

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "project_incomplete"
    assert error["message"].startswith("Missing: short_description")


async def test_complete_draft_is_published_under_its_name(
    client: AsyncClient, storage: FakeStorage, github_routes: GitHubRoutes, reflex_readme: str
) -> None:
    project_id = await complete_reflex_draft(client, storage, github_routes, reflex_readme)

    response = await client.post(f"/api/v1/projects/{project_id}/publish")

    assert response.status_code == 200
    body = response.json()
    assert body["slug"] == "reflex"
    assert body["published_at"] is not None
    assert body["missing_fields"] == []


async def test_same_name_gets_the_next_free_address(
    client: AsyncClient, storage: FakeStorage, github_routes: GitHubRoutes, reflex_readme: str
) -> None:
    first = await complete_reflex_draft(client, storage, github_routes, reflex_readme)
    second = await complete_reflex_draft(client, storage, github_routes, reflex_readme)
    await client.post(f"/api/v1/projects/{first}/publish")

    response = await client.post(f"/api/v1/projects/{second}/publish")

    assert response.json()["slug"] == "reflex-2"


async def test_uzbek_name_gets_a_clean_address(
    client: AsyncClient, storage: FakeStorage, github_routes: GitHubRoutes, reflex_readme: str
) -> None:
    project_id = await complete_reflex_draft(client, storage, github_routes, reflex_readme)
    await client.patch(f"/api/v1/projects/{project_id}", json={"name": "O'zbek tili yordamchisi"})

    response = await client.post(f"/api/v1/projects/{project_id}/publish")

    assert response.json()["slug"] == "ozbek-tili-yordamchisi"


async def test_published_project_cannot_be_changed(
    client: AsyncClient, storage: FakeStorage, github_routes: GitHubRoutes, reflex_readme: str
) -> None:
    project_id = await complete_reflex_draft(client, storage, github_routes, reflex_readme)
    await client.post(f"/api/v1/projects/{project_id}/publish")

    response = await client.patch(f"/api/v1/projects/{project_id}", json={"name": "Other"})

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "project_published"


# --- caching -----------------------------------------------------------------------------------


async def test_api_answers_are_never_cached(client: AsyncClient) -> None:
    project_id = await new_draft(client)

    response = await client.get(f"/api/v1/projects/{project_id}")

    assert response.headers["cache-control"] == "no-store"


# --- project page (published projects by address) ------------------------------------------


async def test_published_project_is_found_by_its_address(
    client: AsyncClient, storage: FakeStorage, github_routes: GitHubRoutes, reflex_readme: str
) -> None:
    project_id = await complete_reflex_draft(client, storage, github_routes, reflex_readme)
    await client.post(f"/api/v1/projects/{project_id}/publish")

    response = await client.get("/api/v1/projects/by-slug/reflex")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Reflex"
    assert body["video"]["url"].startswith("https://r2.test/download/videos/")
    assert body["repo"]["full_name"] == "reflex-dev/reflex"


async def test_draft_or_unknown_address_is_not_found(
    client: AsyncClient, storage: FakeStorage, github_routes: GitHubRoutes, reflex_readme: str
) -> None:
    project_id = await complete_reflex_draft(client, storage, github_routes, reflex_readme)
    await client.patch(f"/api/v1/projects/{project_id}", json={"name": "Not published"})

    unknown = await client.get("/api/v1/projects/by-slug/nothing-here")

    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "project_not_found"


async def test_fresh_video_links_for_a_long_open_page(
    client: AsyncClient, storage: FakeStorage, github_routes: GitHubRoutes, reflex_readme: str
) -> None:
    project_id = await complete_reflex_draft(client, storage, github_routes, reflex_readme)
    await client.post(f"/api/v1/projects/{project_id}/publish")

    response = await client.get("/api/v1/projects/by-slug/reflex/video")

    assert response.status_code == 200
    assert response.json()["url"].startswith("https://r2.test/download/videos/")
