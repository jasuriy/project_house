"""Your own projects: POST/GET/PATCH/DELETE /api/v1/me/projects."""

import pytest
from sqlalchemy import select

from app.projects.models import Project
from app.users.service import get_by_username
from tests.media_helpers import file_of, signup, upload
from tests.projects_fixtures import add_projects, make_project

pytest_plugins = ["tests.auth_fixtures", "tests.media_fixtures"]

MINE = "/api/v1/me/projects"
VIDEO = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def body(**overrides) -> dict:
    data = {
        "title": "Weed Finder",
        "one_line_problem": "Farmers search for weeds by hand.",
        "short_description": "Finds weeds in drone photos with YOLO.",
        "field": "cv-ml",
        "tech_stack": ["Python", "YOLO"],
        "video_url": VIDEO,
    }
    data.update(overrides)
    return data


def _code(response) -> str:
    return response.json()["error"]["code"]


async def _upload_id(client) -> tuple[str, str]:
    r = await upload(client)
    assert r.status_code == 201, r.text
    return r.json()["id"], r.json()["url"]


async def test_create_minimal_with_video(auth_client):
    await signup(auth_client)
    r = await auth_client.post(MINE, json=body())
    assert r.status_code == 201, r.text
    project = r.json()
    assert (project["path"], project["demo_video_url"]) == ("/bek/weed-finder", VIDEO)
    assert [m["kind"] for m in project["media"]] == ["video"]
    feed = (await auth_client.get("/api/v1/projects")).json()["items"]
    assert [c["path"] for c in feed] == ["/bek/weed-finder"]
    mine = (await auth_client.get("/api/v1/users/bek/projects")).json()["items"]
    assert [c["path"] for c in mine] == ["/bek/weed-finder"]


async def test_create_with_images_keeps_their_order(auth_client):
    await signup(auth_client)
    (a, a_url), (b, b_url) = await _upload_id(auth_client), await _upload_id(auth_client)
    r = await auth_client.post(MINE, json=body(images=[{"upload": b}, {"upload": a}]))
    media = r.json()["media"]
    assert [m["kind"] for m in media] == ["video", "image", "image"]
    assert [m["url"] for m in media[1:]] == [b_url, a_url]


@pytest.mark.parametrize(
    ("overrides", "code"),
    [
        ({"title": "  "}, "invalid_title"),
        ({"title": "x" * 81}, "invalid_title"),
        ({"one_line_problem": ""}, "invalid_one_line_problem"),
        ({"one_line_problem": "x" * 161}, "invalid_one_line_problem"),
        ({"short_description": "x" * 1001}, "invalid_short_description"),
        ({"result": "x" * 161}, "invalid_result"),
        ({"field": "blockchain"}, "invalid_field"),
        ({"tech_stack": []}, "invalid_tech_stack"),
        ({"tech_stack": [f"t{i}" for i in range(13)]}, "invalid_tech_stack"),
        ({"tech_stack": ["x" * 31]}, "invalid_tech_stack"),
        ({"github_url": "https://gitlab.com/a/b"}, "invalid_github_url"),
        ({"github_url": "https://github.com/onlyowner"}, "invalid_github_url"),
        ({"live_url": "javascript:alert(1)"}, "invalid_live_url"),
        ({"role": "x" * 121}, "invalid_role"),
        ({"video_url": "https://vimeo.com/123"}, "invalid_video_url"),
        ({"video_url": "https://www.youtube.com/watch?v=short"}, "invalid_video_url"),
        ({"images": [{"upload": "not-a-uuid"}]}, "invalid_images"),
    ],
)
async def test_create_field_rules(auth_client, overrides, code):
    await signup(auth_client)
    r = await auth_client.post(MINE, json=body(**overrides))
    assert (r.status_code, _code(r)) == (422, code)


async def test_create_accepts_good_optional_values_and_dedupes_tags(auth_client):
    await signup(auth_client)
    r = await auth_client.post(
        MINE,
        json=body(
            tech_stack=["Python", "python", " YOLO "],
            github_url="https://github.com/aziz/weed-finder",
            live_url="https://weeds.example.com",
            video_url="https://www.loom.com/share/abc123",
            result="91% accuracy",
        ),
    )
    assert r.status_code == 201, r.text
    assert r.json()["tech_stack"] == ["Python", "YOLO"]


async def test_create_requires_video_or_image(auth_client):
    await signup(auth_client)
    r = await auth_client.post(MINE, json=body(video_url=""))
    assert (r.status_code, _code(r)) == (422, "media_required")


async def test_slug_rules(auth_client):
    await signup(auth_client)
    first = (await auth_client.post(MINE, json=body())).json()["slug"]
    second = (await auth_client.post(MINE, json=body())).json()["slug"]
    cyrillic = (await auth_client.post(MINE, json=body(title="Проект"))).json()["slug"]
    assert (first, second, cyrillic) == ("weed-finder", "weed-finder-2", "project")


async def test_upload_ids_must_be_yours_and_media_ids_this_projects(auth_client, db_session):
    await signup(auth_client, "alice")
    alice_upload, _ = await _upload_id(auth_client)
    alice_image, _ = await _upload_id(auth_client)
    created = await auth_client.post(MINE, json=body(images=[{"upload": alice_image}]))
    alice_media_id = (await auth_client.get(f"{MINE}/weed-finder")).json()["images"][0]["id"]
    await auth_client.post("/api/v1/auth/logout")

    await signup(auth_client, "bobby")
    r1 = await auth_client.post(MINE, json=body(images=[{"upload": alice_upload}]))
    r2 = await auth_client.post(MINE, json=body(images=[{"media": alice_media_id}]))
    assert (r1.status_code, _code(r1)) == (422, "invalid_images")
    assert (r2.status_code, _code(r2)) == (422, "invalid_images")
    assert created.status_code == 201
    assert (
        await db_session.scalar(select(Project.id).where(Project.slug == "weed-finder")) is not None
    )


async def test_patch_keeps_slug_when_title_changes(auth_client):
    await signup(auth_client)
    await auth_client.post(MINE, json=body())
    r = await auth_client.patch(f"{MINE}/weed-finder", json={"title": "Weed Finder Pro"})
    assert r.status_code == 200, r.text
    assert (r.json()["title"], r.json()["path"]) == ("Weed Finder Pro", "/bek/weed-finder")


async def test_patch_changes_only_sent_fields_and_validates_them(auth_client):
    await signup(auth_client)
    await auth_client.post(MINE, json=body(result="old"))
    bad = await auth_client.patch(f"{MINE}/weed-finder", json={"result": "x" * 161})
    assert (bad.status_code, _code(bad)) == (422, "invalid_result")
    r = await auth_client.patch(f"{MINE}/weed-finder", json={"result": "new"})
    assert (r.json()["result"], r.json()["title"]) == ("new", "Weed Finder")


async def test_patch_removes_an_image_and_its_file(auth_client, media_root):
    await signup(auth_client)
    a, a_url = await _upload_id(auth_client)
    b, _ = await _upload_id(auth_client)
    await auth_client.post(MINE, json=body(images=[{"upload": a}, {"upload": b}]))
    images = (await auth_client.get(f"{MINE}/weed-finder")).json()["images"]
    r = await auth_client.patch(
        f"{MINE}/weed-finder", json={"images": [{"media": images[1]["id"]}]}
    )
    assert r.status_code == 200, r.text
    assert [m["kind"] for m in r.json()["media"]] == ["video", "image"]
    assert not file_of(media_root, a_url).exists()


async def test_patch_cannot_remove_the_last_picture_and_video(auth_client):
    await signup(auth_client)
    await auth_client.post(MINE, json=body())
    r = await auth_client.patch(f"{MINE}/weed-finder", json={"video_url": ""})
    assert (r.status_code, _code(r)) == (422, "media_required")


async def test_delete_removes_project_and_its_files(auth_client, media_root):
    await signup(auth_client)
    a, a_url = await _upload_id(auth_client)
    await auth_client.post(MINE, json=body(images=[{"upload": a}]))
    r = await auth_client.delete(f"{MINE}/weed-finder")
    assert r.status_code == 204
    assert (await auth_client.get("/api/v1/users/bek/projects/weed-finder")).status_code == 404
    assert not file_of(media_root, a_url).exists()


async def test_owned_sample_can_be_deleted_but_not_edited(auth_client, db_session):
    await signup(auth_client)
    bek = await get_by_username(db_session, "bek")
    await add_projects(db_session, make_project(slug="sample", owner_id=bek.id))

    patch = await auth_client.patch(f"{MINE}/sample", json={"title": "Mine now"})
    assert (patch.status_code, _code(patch)) == (403, "sample_read_only")
    assert (await auth_client.delete(f"{MINE}/sample")).status_code == 204


async def test_company_cannot_create(auth_client):
    await signup(auth_client, account_type="company")
    r = await auth_client.post(MINE, json=body())
    assert (r.status_code, _code(r)) == (403, "developers_only")


async def test_someone_elses_slug_is_404(auth_client):
    await signup(auth_client, "alice")
    await auth_client.post(MINE, json=body())
    await auth_client.post("/api/v1/auth/logout")
    await signup(auth_client, "bobby")
    for method in ("get", "patch", "delete"):
        kwargs = {"json": {"title": "x"}} if method == "patch" else {}
        r = await getattr(auth_client, method)(f"{MINE}/weed-finder", **kwargs)
        assert (r.status_code, _code(r)) == (404, "project_not_found")


async def test_requires_login_and_origin(auth_client):
    assert (await auth_client.post(MINE, json=body())).status_code == 401
    await signup(auth_client)
    del auth_client.headers["Origin"]
    r = await auth_client.post(MINE, json=body())
    assert (r.status_code, _code(r)) == (403, "bad_origin")


async def test_loom_video_with_images_uses_the_first_image_as_cover(auth_client):
    await signup(auth_client)
    a, a_url = await _upload_id(auth_client)
    loom = "https://www.loom.com/share/abc123"
    await auth_client.post(MINE, json=body(video_url=loom, images=[{"upload": a}]))
    card = (await auth_client.get("/api/v1/projects")).json()["items"][0]
    assert card["cover"] == {"kind": "image", "url": a_url}


async def test_youtube_video_stays_the_cover(auth_client):
    await signup(auth_client)
    a, _ = await _upload_id(auth_client)
    await auth_client.post(MINE, json=body(images=[{"upload": a}]))
    card = (await auth_client.get("/api/v1/projects")).json()["items"][0]
    assert card["cover"] == {"kind": "video", "url": VIDEO}
