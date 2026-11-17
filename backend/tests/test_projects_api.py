from datetime import UTC, datetime, timedelta

import pytest

from app.core.pagination import encode_cursor
from tests.projects_fixtures import add_projects, make_project, make_user, media

T0 = datetime(2026, 11, 1, tzinfo=UTC)


def _day(n: int) -> datetime:
    return T0 + timedelta(days=n)


def _newest_first(rows):
    return sorted(rows, key=lambda r: (r.published_at, r.id), reverse=True)


async def _fetch_all_pages(client, limit: int, **params) -> list[list[str]]:
    pages: list[list[str]] = []
    cursor = None
    while True:
        query = {"limit": limit, **params, **({"cursor": cursor} if cursor else {})}
        r = await client.get("/api/v1/projects", params=query)
        assert r.status_code == 200, r.text
        body = r.json()
        pages.append([item["slug"] for item in body["items"]])
        cursor = body["next_cursor"]
        if cursor is None:
            return pages
        assert len(pages) < 20, "cursor never ended"


# ---- feed ---------------------------------------------------------------------------------


async def test_feed_is_newest_first_with_id_tie_break(client, db_session):
    # Inserted so that ids do not follow time: d2, d3, d1, d3, d2.
    rows = [
        make_project(slug="a", published_at=_day(2)),
        make_project(slug="b", published_at=_day(3)),
        make_project(slug="c", published_at=_day(1)),
        make_project(slug="d", published_at=_day(3)),
        make_project(slug="e", published_at=_day(2)),
    ]
    await add_projects(db_session, *rows)
    r = await client.get("/api/v1/projects")
    assert r.status_code == 200
    # Newest day first; within a day, higher id (later insert) first.
    assert [i["slug"] for i in r.json()["items"]] == ["d", "b", "e", "a", "c"]
    assert r.json()["next_cursor"] is None


async def test_feed_empty(client):
    r = await client.get("/api/v1/projects")
    assert r.json() == {"items": [], "next_cursor": None}


async def test_feed_field_filter(client, db_session):
    await add_projects(
        db_session,
        make_project(slug="w1", field="web", published_at=_day(1)),
        make_project(slug="m1", field="mobile", published_at=_day(2)),
        make_project(slug="w2", field="web", published_at=_day(3)),
    )
    r = await client.get("/api/v1/projects", params={"field": "web"})
    assert [i["slug"] for i in r.json()["items"]] == ["w2", "w1"]
    assert {i["field"] for i in r.json()["items"]} == {"web"}


async def test_feed_unknown_field_is_422(client):
    r = await client.get("/api/v1/projects", params={"field": "blockchain"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


@pytest.mark.parametrize("limit", ["0", "61", "-1", "abc"])
async def test_feed_limit_out_of_range_is_422(client, limit):
    r = await client.get("/api/v1/projects", params={"limit": limit})
    assert r.status_code == 422


async def test_feed_limit_is_respected_and_default_is_24(client, db_session):
    await add_projects(
        db_session, *[make_project(slug=f"p{i:02d}", published_at=_day(i)) for i in range(30)]
    )
    assert len((await client.get("/api/v1/projects", params={"limit": 5})).json()["items"]) == 5
    assert len((await client.get("/api/v1/projects", params={"limit": 60})).json()["items"]) == 30
    default = (await client.get("/api/v1/projects")).json()
    assert len(default["items"]) == 24
    assert default["next_cursor"] is not None


async def test_cursor_walk_over_three_pages_has_no_gaps_or_duplicates(client, db_session):
    # 4 rows share one timestamp, 3 another, 1 a third: page boundaries fall inside tie groups,
    # so only the id tie-break keeps the walk exact. Inserted out of time order.
    stamps = [_day(2), _day(1), _day(2), _day(3), _day(1), _day(2), _day(1), _day(2)]
    rows = [make_project(slug=f"p{i}", published_at=t) for i, t in enumerate(stamps)]
    await add_projects(db_session, *rows)
    expected = [r.slug for r in _newest_first(rows)]

    pages = await _fetch_all_pages(client, limit=3)

    assert [len(p) for p in pages] == [3, 3, 2]
    flat = [slug for page in pages for slug in page]
    assert flat == expected
    assert len(set(flat)) == len(rows)


async def test_exactly_limit_rows_has_no_next_cursor(client, db_session):
    await add_projects(db_session, *[make_project(published_at=_day(i)) for i in range(3)])
    body = (await client.get("/api/v1/projects", params={"limit": 3})).json()
    assert len(body["items"]) == 3
    assert body["next_cursor"] is None


async def test_cursor_combined_with_field_filter(client, db_session):
    rows = [
        make_project(slug=f"{f}{i}", field=f, published_at=_day(i % 3))
        for i in range(4)
        for f in ("web", "data")
    ]
    await add_projects(db_session, *rows)
    web = [r.slug for r in _newest_first(rows) if r.field == "web"]

    pages = await _fetch_all_pages(client, limit=3, field="web")

    assert [len(p) for p in pages] == [3, 1]
    assert [s for p in pages for s in p] == web


@pytest.mark.parametrize("cursor", ["not-a-cursor", "e30", "%%%", "a" * 600])
async def test_bad_cursor_is_400(client, cursor):
    r = await client.get("/api/v1/projects", params={"cursor": cursor})
    assert r.status_code == 400
    assert r.json() == {"error": {"code": "invalid_cursor", "message": "Invalid cursor"}}


async def test_well_formed_cursor_past_all_rows_returns_older_rows(client, db_session):
    await add_projects(db_session, make_project(slug="old", published_at=_day(1)))
    cursor = encode_cursor(_day(5), 10**6)
    r = await client.get("/api/v1/projects", params={"cursor": cursor})
    assert [i["slug"] for i in r.json()["items"]] == ["old"]


# ---- card ---------------------------------------------------------------------------------


async def test_card_shape_for_demo_project(client, db_session):
    await add_projects(
        db_session,
        make_project(
            slug="cam",
            title="Cam",
            one_line_problem="Problem.",
            field="cv-ml",
            tech_stack=["Py", "C++", "CUDA", "Rust", "Go"],
            demo_author="jacobgil",
            demo_author_url="https://github.com/jacobgil",
            published_at=_day(4),
            # Position order differs from insert order: the cover is position 0.
            media=[media("image", "https://x/second.png", 1), media("video", "https://x/v", 0)],
        ),
    )
    item = (await client.get("/api/v1/projects")).json()["items"][0]
    assert item == {
        "slug": "cam",
        "path": "/demo/cam",
        "title": "Cam",
        "one_line_problem": "Problem.",
        "field": "cv-ml",
        "tech_stack": ["Py", "C++", "CUDA"],
        "cover": {"kind": "video", "url": "https://x/v"},
        "author": {"kind": "demo", "name": "jacobgil", "url": "https://github.com/jacobgil"},
        "published_at": "2026-11-05T00:00:00Z",
    }


async def test_card_without_media_has_null_cover(client, db_session):
    await add_projects(db_session, make_project())
    assert (await client.get("/api/v1/projects")).json()["items"][0]["cover"] is None


async def test_card_for_user_project(client, db_session):
    user = await make_user(db_session, "aziz", "Aziz R.")
    await add_projects(
        db_session, make_project(is_demo=False, owner_id=user.id, demo_author=None, slug="mine")
    )
    item = (await client.get("/api/v1/projects")).json()["items"][0]
    assert item["path"] == "/aziz/mine"
    assert item["author"] == {"kind": "user", "name": "Aziz R.", "url": "/aziz"}


# ---- detail -------------------------------------------------------------------------------


async def test_demo_detail_200_with_ordered_media_and_full_stack(client, db_session):
    await add_projects(
        db_session,
        make_project(
            slug="cam",
            tech_stack=["Py", "C++", "CUDA", "Rust"],
            github_url="https://github.com/o/cam",
            demo_video_url="https://youtu.be/x",
            license="MIT",
            result="Fast.",
            media=[
                media("image", "https://x/3", 2, "third"),
                media("video", "https://x/1", 0),
                media("image", "https://x/2", 1),
            ],
        ),
    )
    r = await client.get("/api/v1/projects/demo/cam")
    assert r.status_code == 200
    body = r.json()
    assert [m["url"] for m in body["media"]] == ["https://x/1", "https://x/2", "https://x/3"]
    assert body["media"][2] == {
        "kind": "image",
        "url": "https://x/3",
        "position": 2,
        "alt": "third",
    }
    assert body["tech_stack"] == ["Py", "C++", "CUDA", "Rust"]
    assert body["path"] == "/demo/cam"
    assert body["author"]["kind"] == "demo"
    assert body["github_url"] == "https://github.com/o/cam"
    assert body["license"] == "MIT"
    assert body["result"] == "Fast."
    assert body["role"] is None
    assert body["is_demo"] is True
    assert "id" not in body and "owner_id" not in body


async def test_detail_returns_live_url_or_null(client, db_session):
    await add_projects(
        db_session,
        make_project(slug="with-link", live_url="https://app.example.com"),
        make_project(slug="without-link"),
    )
    with_link = (await client.get("/api/v1/projects/demo/with-link")).json()
    without_link = (await client.get("/api/v1/projects/demo/without-link")).json()
    assert with_link["live_url"] == "https://app.example.com"
    assert without_link["live_url"] is None


async def test_card_does_not_carry_live_url(client, db_session):
    await add_projects(db_session, make_project(live_url="https://app.example.com"))
    assert "live_url" not in (await client.get("/api/v1/projects")).json()["items"][0]


async def test_unknown_demo_slug_404_error_shape(client):
    r = await client.get("/api/v1/projects/demo/nope")
    assert r.status_code == 404
    assert r.json() == {"error": {"code": "project_not_found", "message": "Project not found"}}


async def test_demo_route_does_not_serve_a_user_project(client, db_session):
    user = await make_user(db_session)
    await add_projects(db_session, make_project(is_demo=False, owner_id=user.id, slug="mine"))
    assert (await client.get("/api/v1/projects/demo/mine")).status_code == 404


async def test_user_project_200(client, db_session):
    user = await make_user(db_session, "aziz", "Aziz R.")
    await add_projects(
        db_session,
        make_project(is_demo=False, owner_id=user.id, slug="mine", role="Backend"),
    )
    r = await client.get("/api/v1/users/aziz/projects/mine")
    assert r.status_code == 200
    body = r.json()
    assert body["path"] == "/aziz/mine"
    assert body["author"] == {"kind": "user", "name": "Aziz R.", "url": "/aziz"}
    assert body["role"] == "Backend"
    assert body["is_demo"] is False


async def test_user_project_404_when_user_missing(client):
    r = await client.get("/api/v1/users/nobody/projects/mine")
    assert r.status_code == 404
    assert r.json() == {"error": {"code": "user_not_found", "message": "User not found"}}


async def test_user_project_404_when_project_missing(client, db_session):
    await make_user(db_session)
    r = await client.get("/api/v1/users/aziz/projects/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "project_not_found"


async def test_user_project_route_is_scoped_to_the_owner(client, db_session):
    a = await make_user(db_session, "aziz")
    await make_user(db_session, "bobur")
    await add_projects(db_session, make_project(is_demo=False, owner_id=a.id, slug="mine"))
    assert (await client.get("/api/v1/users/bobur/projects/mine")).status_code == 404
    assert (await client.get("/api/v1/users/aziz/projects/mine")).status_code == 200


def _owned(user, slug: str, day: int):
    return make_project(
        is_demo=False,
        owner_id=user.id,
        demo_author=None,
        demo_author_url=None,
        slug=slug,
        published_at=_day(day),
    )


async def test_user_projects_lists_only_that_users_projects_newest_first(client, db_session):
    a = await make_user(db_session, username="aaa")
    b = await make_user(db_session, username="bbb")
    await add_projects(
        db_session,
        _owned(a, "a1", 1),
        _owned(a, "a3", 3),
        _owned(a, "a2", 2),
        _owned(b, "b1", 4),
        make_project(slug="demo-x"),
    )

    r = await client.get("/api/v1/users/aaa/projects")
    assert r.status_code == 200, r.text
    assert [i["path"] for i in r.json()["items"]] == ["/aaa/a3", "/aaa/a2", "/aaa/a1"]


async def test_user_projects_pages_with_cursor(client, db_session):
    a = await make_user(db_session, username="aaa")
    await add_projects(db_session, _owned(a, "a1", 1), _owned(a, "a2", 2), _owned(a, "a3", 3))

    first = (await client.get("/api/v1/users/aaa/projects", params={"limit": 2})).json()
    assert [i["slug"] for i in first["items"]] == ["a3", "a2"]
    second = (
        await client.get(
            "/api/v1/users/aaa/projects", params={"limit": 2, "cursor": first["next_cursor"]}
        )
    ).json()
    assert ([i["slug"] for i in second["items"]], second["next_cursor"]) == (["a1"], None)


async def test_user_projects_unknown_user_is_404(client):
    r = await client.get("/api/v1/users/nobody/projects")
    assert (r.status_code, r.json()["error"]["code"]) == (404, "user_not_found")


async def test_owned_sample_shows_the_owner_and_lives_under_their_name(client, db_session):
    user = await make_user(db_session, username="bek", display_name="Bek")
    await add_projects(db_session, make_project(slug="tool", owner_id=user.id))

    card = (await client.get("/api/v1/projects")).json()["items"][0]
    assert card["author"] == {"kind": "user", "name": "Bek", "url": "/bek"}
    assert card["path"] == "/bek/tool"
    assert (await client.get("/api/v1/users/bek/projects/tool")).status_code == 200
    assert (await client.get("/api/v1/projects/demo/tool")).status_code == 404
