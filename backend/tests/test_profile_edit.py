"""PATCH /api/v1/auth/me: the signed-in user edits their own profile."""

import pytest

from tests.auth_helpers import signup_body

pytest_plugins = ["tests.auth_fixtures"]

ME = "/api/v1/auth/me"


async def _signup(client, account_type: str = "developer") -> None:
    r = await client.post("/api/v1/auth/signup", json=signup_body(account_type=account_type))
    assert r.status_code == 201, r.text


async def _patch(client, body: dict):
    return await client.patch(ME, json=body)


def _code(response) -> str:
    return response.json()["error"]["code"]


async def test_patch_updates_given_fields_only(auth_client):
    await _signup(auth_client)
    await _patch(auth_client, {"location": "Tashkent"})
    r = await _patch(auth_client, {"headline": "CV student"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert (body["headline"], body["location"]) == ("CV student", "Tashkent")
    assert (await auth_client.get(ME)).json()["headline"] == "CV student"


async def test_patch_trims_and_clears(auth_client):
    await _signup(auth_client)
    await _patch(auth_client, {"headline": "x"})
    body = (await _patch(auth_client, {"headline": "   ", "location": "  Tashkent "})).json()
    assert (body["headline"], body["location"]) == (None, "Tashkent")


async def test_patch_rejects_blank_display_name(auth_client):
    await _signup(auth_client)
    r = await _patch(auth_client, {"display_name": "  "})
    assert (r.status_code, _code(r)) == (422, "invalid_display_name")


@pytest.mark.parametrize(
    ("field", "length", "code"),
    [
        ("display_name", 61, "invalid_display_name"),
        ("headline", 121, "invalid_headline"),
        ("location", 81, "invalid_location"),
        ("university_or_employer", 121, "invalid_university_or_employer"),
        ("about", 1001, "invalid_about"),
    ],
)
async def test_patch_length_limits(auth_client, field, length, code):
    await _signup(auth_client)
    r = await _patch(auth_client, {field: "x" * length})
    assert (r.status_code, _code(r)) == (422, code)


async def test_patch_value_at_the_limit_is_accepted(auth_client):
    await _signup(auth_client)
    r = await _patch(auth_client, {"headline": "x" * 120})
    assert r.status_code == 200, r.text


async def test_patch_rejects_nul_in_text(auth_client):
    await _signup(auth_client)
    r = await _patch(auth_client, {"about": "a\x00b"})
    assert (r.status_code, _code(r)) == (422, "invalid_about")


@pytest.mark.parametrize(
    ("key", "url", "code"),
    [
        ("github", "https://github.com/aziz", None),
        ("github", "http://github.com/aziz", "invalid_github_link"),
        ("github", "https://gitlab.com/aziz", "invalid_github_link"),
        ("github", "https://github.com/aziz/repo", "invalid_github_link"),
        ("github", "javascript:alert(1)", "invalid_github_link"),
        ("github", "https://github.com/" + "a" * 40, "invalid_github_link"),
        ("github", "https://github.com:8443/aziz", "invalid_github_link"),
        ("github", "https://github.com/aziz?tab=repos", "invalid_github_link"),
        ("github", "https://github.com/..", "invalid_github_link"),
        ("linkedin", "https://www.linkedin.com/in/aziz", None),
        ("linkedin", "https://linkedin.evil.com/x", "invalid_linkedin_link"),
        ("linkedin", "https://linkedin.com/in/" + "b" * 200, "invalid_linkedin_link"),
        ("website", "https://aziz.dev", None),
        ("website", "http://aziz.dev", "invalid_website_link"),
        ("website", "https://" + "a" * 193, "invalid_website_link"),
    ],
)
async def test_patch_links(auth_client, key, url, code):
    await _signup(auth_client)
    r = await _patch(auth_client, {"links": {key: url}})
    if code is None:
        assert r.status_code == 200, r.text
        assert r.json()["links"][key] == url
    else:
        assert (r.status_code, _code(r)) == (422, code)


async def test_patch_empty_link_removes_key_and_keeps_others(auth_client):
    await _signup(auth_client)
    await _patch(
        auth_client,
        {"links": {"github": "https://github.com/bek", "website": "https://bek.dev"}},
    )
    body = (await _patch(auth_client, {"links": {"github": ""}})).json()
    assert body["links"] == {"website": "https://bek.dev"}


@pytest.mark.parametrize(
    "body",
    [
        {"open_to_work": True},
        {"university_or_employer": "TATU"},
        {"links": {"github": "https://github.com/bek"}},
        {"links": {"linkedin": "https://linkedin.com/in/bek"}},
    ],
)
async def test_company_cannot_set_developer_fields(auth_client, body):
    await _signup(auth_client, account_type="company")
    r = await _patch(auth_client, {"headline": "HR manager", **body})
    assert (r.status_code, _code(r)) == (422, "field_not_allowed")
    assert (await auth_client.get(ME)).json()["headline"] is None


async def test_developer_cannot_set_company_name(auth_client):
    await _signup(auth_client)
    r = await _patch(auth_client, {"company_name": "Nova"})
    assert (r.status_code, _code(r)) == (422, "field_not_allowed")


@pytest.mark.parametrize(
    "body",
    [
        {"username": "other"},
        {"account_type": "company"},
        {"is_verified_company": True},
        {"avatar_url": "https://x/a.png"},
        {"links": {"telegram": "https://t.me/x"}},
    ],
)
async def test_patch_cannot_change_fixed_fields(auth_client, body):
    await _signup(auth_client)
    r = await _patch(auth_client, body)
    assert (r.status_code, _code(r)) == (422, "validation_error")


async def test_open_to_work_null_changes_nothing(auth_client):
    await _signup(auth_client)
    await _patch(auth_client, {"open_to_work": True})
    r = await _patch(auth_client, {"open_to_work": None})
    assert (r.status_code, r.json()["open_to_work"]) == (200, True)


async def test_first_failure_writes_nothing(auth_client):
    await _signup(auth_client)
    r = await _patch(auth_client, {"headline": "ok", "about": "x" * 1001})
    assert r.status_code == 422
    assert (await auth_client.get(ME)).json()["headline"] is None


async def test_patch_requires_login(auth_client):
    r = await _patch(auth_client, {"headline": "x"})
    assert r.status_code == 401


async def test_patch_without_origin_is_403(auth_client):
    await _signup(auth_client)
    del auth_client.headers["Origin"]
    r = await _patch(auth_client, {"headline": "x"})
    assert (r.status_code, _code(r)) == (403, "bad_origin")
