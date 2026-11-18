"""Likes, saves, counts and your own Saved and Liked lists."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import event

from app.core.errors import AppError
from app.users.service import create_user, get_by_username
from tests.auth_helpers import PASSWORD
from tests.media_helpers import signup
from tests.projects_fixtures import add_projects, make_project

pytest_plugins = ["tests.auth_fixtures"]

T0 = datetime(2026, 11, 1, tzinfo=UTC)


async def _owned(db_session, owner: str, slug: str, day: int = 1) -> int:
    user = await get_by_username(db_session, owner)
    project = make_project(
        is_demo=False,
        owner_id=user.id,
        demo_author=None,
        demo_author_url=None,
        slug=slug,
        published_at=T0 + timedelta(days=day),
    )
    await add_projects(db_session, project)
    return project.id


async def _switch(client, username: str) -> None:
    """Log out and sign up as `username` (a fresh developer)."""
    await client.post("/api/v1/auth/logout")
    await signup(client, username)


async def _detail(client, owner: str, slug: str) -> dict:
    r = await client.get(f"/api/v1/users/{owner}/projects/{slug}")
    assert r.status_code == 200, r.text
    return r.json()


async def test_like_and_unlike_are_idempotent(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    for _ in range(2):
        assert (await auth_client.put(f"/api/v1/me/likes/{pid}")).status_code == 204
    assert (await _detail(auth_client, "alice", "tool"))["like_count"] == 1
    for _ in range(2):
        assert (await auth_client.delete(f"/api/v1/me/likes/{pid}")).status_code == 204
    assert (await _detail(auth_client, "alice", "tool"))["like_count"] == 0


async def test_like_unknown_project_is_404(auth_client):
    await signup(auth_client)
    r = await auth_client.put("/api/v1/me/likes/999999")
    assert (r.status_code, r.json()["error"]["code"]) == (404, "project_not_found")


async def test_like_and_save_need_login_and_origin(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    await auth_client.post("/api/v1/auth/logout")
    assert (await auth_client.put(f"/api/v1/me/likes/{pid}")).status_code == 401
    await signup(auth_client, "bobby")
    del auth_client.headers["Origin"]
    assert (await auth_client.put(f"/api/v1/me/saves/{pid}")).status_code == 403


async def test_detail_shows_count_and_viewer_state(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    await auth_client.put(f"/api/v1/me/likes/{pid}")
    await _switch(auth_client, "bobby")
    body = await _detail(auth_client, "alice", "tool")
    assert (body["id"], body["like_count"], body["liked"], body["saved"]) == (pid, 1, False, False)
    await auth_client.put(f"/api/v1/me/likes/{pid}")
    await auth_client.put(f"/api/v1/me/saves/{pid}")
    body = await _detail(auth_client, "alice", "tool")
    assert (body["like_count"], body["liked"], body["saved"]) == (2, True, True)
    await auth_client.post("/api/v1/auth/logout")
    body = await _detail(auth_client, "alice", "tool")
    assert (body["like_count"], body["liked"], body["saved"]) == (2, False, False)


async def test_detail_with_an_invalid_cookie_is_still_200(auth_client, db_session):
    await signup(auth_client, "alice")
    await _owned(db_session, "alice", "tool")
    auth_client.cookies.set("ph_session", "not-a-real-session")
    body = await _detail(auth_client, "alice", "tool")
    assert body["liked"] is False


async def test_cards_carry_like_counts(auth_client, db_session):
    await signup(auth_client, "alice")
    liked = await _owned(db_session, "alice", "liked", day=2)
    await _owned(db_session, "alice", "plain", day=1)
    await auth_client.put(f"/api/v1/me/likes/{liked}")
    feed = (await auth_client.get("/api/v1/projects")).json()["items"]
    mine = (await auth_client.get("/api/v1/users/alice/projects")).json()["items"]
    for items in (feed, mine):
        assert [(c["slug"], c["like_count"]) for c in items] == [("liked", 1), ("plain", 0)]
        assert items[0]["id"] == liked


async def test_saved_and_liked_lists_are_mine_only_and_newest_first(auth_client, db_session):
    await signup(auth_client, "alice")
    old = await _owned(db_session, "alice", "old", day=1)
    new = await _owned(db_session, "alice", "new", day=9)
    third = await _owned(db_session, "alice", "third", day=5)
    # Saved in this order: the newest-published one first, so save time differs from publish time.
    for pid in (new, old, third):
        await auth_client.put(f"/api/v1/me/saves/{pid}")
    await auth_client.put(f"/api/v1/me/likes/{old}")
    await _switch(auth_client, "bobby")
    await auth_client.put(f"/api/v1/me/saves/{new}")
    assert [c["slug"] for c in (await auth_client.get("/api/v1/me/saved")).json()["items"]] == [
        "new"
    ]
    assert (await auth_client.get("/api/v1/me/liked")).json()["items"] == []

    await auth_client.post("/api/v1/auth/logout")
    await auth_client.post(
        "/api/v1/auth/login", json={"email": "alice@example.com", "password": PASSWORD}
    )
    first = (await auth_client.get("/api/v1/me/saved", params={"limit": 2})).json()
    assert [c["slug"] for c in first["items"]] == ["third", "old"]
    rest = (
        await auth_client.get(
            "/api/v1/me/saved", params={"limit": 2, "cursor": first["next_cursor"]}
        )
    ).json()
    assert ([c["slug"] for c in rest["items"]], rest["next_cursor"]) == (["new"], None)
    assert [c["slug"] for c in (await auth_client.get("/api/v1/me/liked")).json()["items"]] == [
        "old"
    ]


async def test_lists_need_login(auth_client):
    for path in ("/api/v1/me/saved", "/api/v1/me/liked"):
        assert (await auth_client.get(path)).status_code == 401


async def test_profile_like_total(auth_client, db_session):
    await signup(auth_client, "alice")
    a = await _owned(db_session, "alice", "a")
    b = await _owned(db_session, "alice", "b")
    await auth_client.put(f"/api/v1/me/likes/{a}")
    await _switch(auth_client, "bobby")
    await auth_client.put(f"/api/v1/me/likes/{a}")
    await auth_client.put(f"/api/v1/me/likes/{b}")
    assert (await auth_client.get("/api/v1/users/alice")).json()["like_total"] == 3
    assert (await auth_client.get("/api/v1/users/bobby")).json()["like_total"] == 0


async def test_deleting_a_project_removes_its_likes_and_saves(auth_client, db_session):
    await signup(auth_client, "alice")
    keep = await _owned(db_session, "alice", "keep")
    gone = await _owned(db_session, "alice", "gone")
    for pid in (keep, gone):
        await auth_client.put(f"/api/v1/me/likes/{pid}")
        await auth_client.put(f"/api/v1/me/saves/{pid}")
    assert (await auth_client.delete("/api/v1/me/projects/gone")).status_code == 204
    assert [c["slug"] for c in (await auth_client.get("/api/v1/me/saved")).json()["items"]] == [
        "keep"
    ]
    assert (await auth_client.get("/api/v1/users/alice")).json()["like_total"] == 1


@pytest.mark.parametrize("name", ["saved", "liked"])
async def test_saved_and_liked_are_reserved_usernames(db_session, name):
    with pytest.raises(AppError) as exc:
        await create_user(db_session, username=name, display_name="X", account_type="developer")
    assert exc.value.code == "invalid_username"


async def test_like_counts_cost_no_extra_query_per_card(auth_client, db_session, engine):
    await signup(auth_client, "alice")
    for i in range(2):
        await _owned(db_session, "alice", f"p{i}", day=i + 1)

    statements: list[str] = []

    def count(conn, cursor, statement, *args):
        statements.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", count)
    try:
        await auth_client.get("/api/v1/projects")
        with_two = len(statements)
        for i in range(2, 24):
            await _owned(db_session, "alice", f"p{i}", day=i + 1)
        statements.clear()
        await auth_client.get("/api/v1/projects")
        with_24 = len(statements)
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", count)
    assert with_24 == with_two
