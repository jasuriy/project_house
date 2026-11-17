"""Origin check on state-changing requests under /api/."""

import pytest

from app.auth.csrf import origin_of
from app.core.config import get_settings

pytest_plugins = ["tests.auth_fixtures"]

BASE = "/api/v1/auth"


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("http://localhost:3000", "http://localhost:3000"),
        ("http://localhost:3000/", "http://localhost:3000"),
        ("http://localhost:3000/some/page?x=1", "http://localhost:3000"),
        ("HTTPS://ProjectHouse.uz", "https://projecthouse.uz"),
        ("https://projecthouse.uz:443", "https://projecthouse.uz"),
        ("http://projecthouse.uz:80/", "http://projecthouse.uz"),
        ("https://projecthouse.uz:8443", "https://projecthouse.uz:8443"),
        ("null", None),
        ("", None),
        ("localhost:3000", None),
        ("file:///etc/passwd", None),
        ("http://", None),
    ],
)
def test_origin_of(url, expected):
    assert origin_of(url) == expected


async def test_foreign_origin_is_403(auth_client):
    auth_client.headers["Origin"] = "http://evil.example"
    response = await auth_client.post(f"{BASE}/logout")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "bad_origin"


async def test_correct_origin_passes(auth_client):
    assert (await auth_client.post(f"{BASE}/logout")).status_code == 204


async def test_no_origin_and_no_referer_is_403(auth_client):
    auth_client.headers.pop("Origin")
    response = await auth_client.post(f"{BASE}/logout")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "bad_origin"


@pytest.mark.parametrize(
    "origin",
    [
        "null",
        "http://localhost:3000.evil.com",
        "http://localhost:30000",
        "https://localhost:3000",
        "http://evil.com/http://localhost:3000",
        "http://localhost:3000@evil.com",
    ],
)
async def test_lookalike_origins_are_403(auth_client, origin):
    auth_client.headers["Origin"] = origin
    assert (await auth_client.post(f"{BASE}/logout")).status_code == 403


async def test_referer_is_used_when_origin_is_absent(auth_client):
    auth_client.headers.pop("Origin")
    ok = await auth_client.post(
        f"{BASE}/logout", headers={"Referer": "http://localhost:3000/some/page"}
    )
    assert ok.status_code == 204


@pytest.mark.parametrize(
    "referer",
    [
        "http://localhost:3000.evil.com/",
        "http://evil.example/http://localhost:3000/",
        "http://evil.example/",
        "garbage",
    ],
)
async def test_bad_referer_is_403(auth_client, referer):
    auth_client.headers.pop("Origin")
    response = await auth_client.post(f"{BASE}/logout", headers={"Referer": referer})
    assert response.status_code == 403


async def test_wrong_origin_is_not_rescued_by_a_matching_referer(auth_client):
    auth_client.headers["Origin"] = "http://evil.example"
    response = await auth_client.post(
        f"{BASE}/logout", headers={"Referer": "http://localhost:3000/"}
    )
    assert response.status_code == 403


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
async def test_every_unsafe_method_is_checked(auth_client, method):
    auth_client.headers["Origin"] = "http://evil.example"
    response = await auth_client.request(method, "/api/v1/anything")
    assert response.status_code == 403


async def test_safe_methods_and_non_api_paths_are_not_checked(auth_client):
    auth_client.headers["Origin"] = "http://evil.example"
    assert (await auth_client.get("/api/health")).status_code in (200, 503)
    assert (await auth_client.post("/not-api")).status_code == 404


async def test_public_base_url_is_normalized(auth_client, monkeypatch):
    monkeypatch.setattr(get_settings(), "public_base_url", "https://projecthouse.uz/")
    auth_client.headers["Origin"] = "https://projecthouse.uz"
    assert (await auth_client.post(f"{BASE}/logout")).status_code == 204
    auth_client.headers["Origin"] = "https://projecthouse.uz:443"
    assert (await auth_client.post(f"{BASE}/logout")).status_code == 204
    auth_client.headers["Origin"] = "http://projecthouse.uz"
    assert (await auth_client.post(f"{BASE}/logout")).status_code == 403
