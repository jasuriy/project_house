"""Comments under a project and reports on projects and comments."""

import pytest
from sqlalchemy import delete, select

from app.social.models import Report
from app.users.models import User
from tests.auth_helpers import PASSWORD
from tests.media_helpers import signup
from tests.projects_fixtures import add_projects, make_project
from tests.test_social_likes import _owned, _switch

pytest_plugins = ["tests.auth_fixtures"]

REPORTS = "/api/v1/me/reports"


def _comments(pid: int) -> str:
    return f"/api/v1/projects/{pid}/comments"


async def _comment(client, pid: int, body: str = "Nice work") -> dict:
    r = await client.post(_comments(pid), json={"body": body})
    assert r.status_code == 201, r.text
    return r.json()


async def _reports(db_session) -> list[Report]:
    rows = await db_session.scalars(
        select(Report).order_by(Report.id).execution_options(populate_existing=True)
    )
    return list(rows)


# ---- comments ------------------------------------------------------------------------------


async def test_post_comment_trims_and_returns_it(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    c = await _comment(auth_client, pid, "  Great tool  ")
    assert c["body"] == "Great tool"
    assert c["author"] == {"name": "Bek", "url": "/alice", "avatar_url": None}
    assert c["can_delete"] is True
    assert isinstance(c["id"], int)


@pytest.mark.parametrize("body", ["", "   ", "x" * 1001, "a\x00b"])
async def test_bad_comment_body_is_invalid_comment(auth_client, db_session, body):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    r = await auth_client.post(_comments(pid), json={"body": body})
    assert (r.status_code, r.json()["error"]["code"]) == (422, "invalid_comment")


async def test_comment_of_1000_characters_is_fine(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    assert (await _comment(auth_client, pid, "x" * 1000))["body"] == "x" * 1000


async def test_comment_on_unknown_project_is_404(auth_client):
    await signup(auth_client, "alice")
    r = await auth_client.post(_comments(999999), json={"body": "Hi"})
    assert (r.status_code, r.json()["error"]["code"]) == (404, "project_not_found")
    r = await auth_client.get(_comments(999999))
    assert (r.status_code, r.json()["error"]["code"]) == (404, "project_not_found")


async def test_writing_needs_login(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    await auth_client.post("/api/v1/auth/logout")
    assert (await auth_client.post(_comments(pid), json={"body": "Hi"})).status_code == 401
    assert (await auth_client.delete("/api/v1/me/comments/1")).status_code == 401
    r = await auth_client.post(REPORTS, json={"project_id": pid, "reason": "spam"})
    assert r.status_code == 401


async def test_comments_are_oldest_first_with_a_cursor(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    for i in range(5):
        await _comment(auth_client, pid, f"c{i}")
    first = (await auth_client.get(_comments(pid), params={"limit": 3})).json()
    assert [c["body"] for c in first["items"]] == ["c0", "c1", "c2"]
    rest = (
        await auth_client.get(_comments(pid), params={"limit": 3, "cursor": first["next_cursor"]})
    ).json()
    assert [c["body"] for c in rest["items"]] == ["c3", "c4"]
    assert rest["next_cursor"] is None


async def test_comment_count_on_the_project_page(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    await _comment(auth_client, pid)
    await _comment(auth_client, pid)
    detail = (await auth_client.get("/api/v1/users/alice/projects/tool")).json()
    assert detail["comment_count"] == 2


async def test_author_deletes_own_comment(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    await _switch(auth_client, "bobby")
    c = await _comment(auth_client, pid)
    assert (await auth_client.delete(f"/api/v1/me/comments/{c['id']}")).status_code == 204
    assert (await auth_client.get(_comments(pid))).json()["items"] == []


async def test_project_owner_deletes_anothers_comment(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    await _switch(auth_client, "bobby")
    c = await _comment(auth_client, pid)
    await _login(auth_client, "alice")
    assert (await auth_client.delete(f"/api/v1/me/comments/{c['id']}")).status_code == 204


async def test_a_third_person_cannot_delete_a_comment(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    await _switch(auth_client, "bobby")
    c = await _comment(auth_client, pid)
    await _switch(auth_client, "carol")
    r = await auth_client.delete(f"/api/v1/me/comments/{c['id']}")
    assert (r.status_code, r.json()["error"]["code"]) == (404, "comment_not_found")
    assert len((await auth_client.get(_comments(pid))).json()["items"]) == 1


async def test_on_a_sample_only_the_author_deletes(auth_client, db_session):
    sample = make_project(slug="sample")
    await add_projects(db_session, sample)
    await signup(auth_client, "alice")
    c = await _comment(auth_client, sample.id)
    await _switch(auth_client, "bobby")
    assert (await auth_client.delete(f"/api/v1/me/comments/{c['id']}")).status_code == 404
    await _switch(auth_client, "carol")
    assert (await auth_client.get(_comments(sample.id))).json()["items"][0]["can_delete"] is False


async def test_can_delete_for_author_owner_stranger_and_guest(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    await _switch(auth_client, "bobby")
    await _comment(auth_client, pid)

    async def can_delete() -> bool:
        return (await auth_client.get(_comments(pid))).json()["items"][0]["can_delete"]

    assert await can_delete() is True  # bobby, the author
    await _switch(auth_client, "carol")
    assert await can_delete() is False  # a stranger
    await auth_client.post("/api/v1/auth/logout")
    assert await can_delete() is False  # logged out
    await _login(auth_client, "alice")
    assert await can_delete() is True  # alice, the project owner


async def _login(client, username: str) -> None:
    await client.post("/api/v1/auth/logout")
    body = {"email": f"{username}@example.com", "password": PASSWORD}
    r = await client.post("/api/v1/auth/login", json=body)
    assert r.status_code == 200, r.text


# ---- reports -------------------------------------------------------------------------------


async def test_report_a_project_then_repeat_is_200_and_one_row(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    title = (await auth_client.get("/api/v1/users/alice/projects/tool")).json()["title"]
    await _switch(auth_client, "bobby")
    body = {"project_id": pid, "reason": "not_own_work", "note": "  Copied from X  "}
    assert (await auth_client.post(REPORTS, json=body)).status_code == 201
    assert (await auth_client.post(REPORTS, json=body)).status_code == 200
    [report] = await _reports(db_session)
    assert (report.target_kind, report.project_id, report.comment_id) == ("project", pid, None)
    assert (report.reason, report.note) == ("not_own_work", "Copied from X")
    assert report.snapshot == title  # the project's title at report time


async def test_report_a_comment(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    c = await _comment(auth_client, pid, "Buy cheap watches")
    await _switch(auth_client, "bobby")
    body = {"comment_id": c["id"], "reason": "spam"}
    assert (await auth_client.post(REPORTS, json=body)).status_code == 201
    assert (await auth_client.post(REPORTS, json=body)).status_code == 200
    [report] = await _reports(db_session)
    assert (report.target_kind, report.comment_id, report.project_id) == ("comment", c["id"], pid)
    assert (report.snapshot, report.note) == ("Buy cheap watches", None)


async def test_two_people_can_report_the_same_project(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    for name in ("bobby", "carol"):
        await _switch(auth_client, name)
        r = await auth_client.post(REPORTS, json={"project_id": pid, "reason": "spam"})
        assert r.status_code == 201
    assert len(await _reports(db_session)) == 2


@pytest.mark.parametrize(
    "body",
    [
        {"reason": "spam"},  # no target
        {"project_id": 1, "comment_id": 1, "reason": "spam"},  # both targets
        {"project_id": "PID", "reason": "boring"},  # unknown reason
        {"project_id": "PID", "reason": "other", "note": "x" * 501},
        {"project_id": "PID", "reason": "other", "note": "a\x00b"},
    ],
)
async def test_bad_report_is_invalid_report(auth_client, db_session, body):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    body = {k: pid if v == "PID" else v for k, v in body.items()}
    r = await auth_client.post(REPORTS, json=body)
    assert (r.status_code, r.json()["error"]["code"]) == (422, "invalid_report")


async def test_note_of_500_characters_is_fine(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    body = {"project_id": pid, "reason": "other", "note": "x" * 500}
    assert (await auth_client.post(REPORTS, json=body)).status_code == 201


async def test_report_unknown_target_is_404(auth_client):
    await signup(auth_client, "alice")
    r = await auth_client.post(REPORTS, json={"project_id": 999999, "reason": "spam"})
    assert (r.status_code, r.json()["error"]["code"]) == (404, "project_not_found")
    r = await auth_client.post(REPORTS, json={"comment_id": 999999, "reason": "spam"})
    assert (r.status_code, r.json()["error"]["code"]) == (404, "comment_not_found")


async def test_reports_outlive_the_deleted_project_and_comment(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    title = (await auth_client.get("/api/v1/users/alice/projects/tool")).json()["title"]
    c = await _comment(auth_client, pid, "Rude words")
    await _switch(auth_client, "bobby")
    await auth_client.post(REPORTS, json={"project_id": pid, "reason": "not_own_work"})
    await auth_client.post(REPORTS, json={"comment_id": c["id"], "reason": "offensive"})
    await _login(auth_client, "alice")
    assert (await auth_client.delete(f"/api/v1/me/comments/{c['id']}")).status_code == 204
    assert (await auth_client.delete("/api/v1/me/projects/tool")).status_code == 204
    project_report, comment_report = await _reports(db_session)
    assert (project_report.target_kind, project_report.project_id) == ("project", None)
    assert project_report.snapshot == title
    assert (comment_report.target_kind, comment_report.comment_id) == ("comment", None)
    assert comment_report.snapshot == "Rude words"


async def test_report_outlives_the_reporter(auth_client, db_session):
    await signup(auth_client, "alice")
    pid = await _owned(db_session, "alice", "tool")
    await _switch(auth_client, "bobby")
    await auth_client.post(REPORTS, json={"project_id": pid, "reason": "spam"})
    await db_session.execute(delete(User).where(User.username == "bobby"))
    await db_session.commit()
    [report] = await _reports(db_session)
    assert (report.reporter_id, report.project_id) == (None, pid)
