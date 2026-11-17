from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.errors import AppError
from app.main import create_app


@pytest.fixture
async def error_client() -> AsyncIterator[AsyncClient]:
    """The real app plus throwaway routes that raise each kind of error."""
    app = create_app()

    @app.get("/_t/app-error")
    async def raise_app_error() -> None:
        raise AppError(418, "teapot", "I am a teapot")

    @app.get("/_t/typed")
    async def typed(n: int) -> dict[str, int]:
        return {"n": n}

    @app.post("/_t/login")
    async def login(body: dict[str, str]) -> None: ...

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_app_error_returns_error_shape(error_client):
    r = await error_client.get("/_t/app-error")
    assert r.status_code == 418
    assert r.json() == {"error": {"code": "teapot", "message": "I am a teapot"}}


async def test_unknown_route_returns_error_shape(error_client):
    r = await error_client.get("/api/v1/nope")
    assert r.status_code == 404
    assert r.json() == {"error": {"code": "not_found", "message": "Not Found"}}


async def test_http_exception_keeps_headers(error_client):
    r = await error_client.post("/_t/app-error")
    assert r.status_code == 405
    assert r.json()["error"]["code"] == "method_not_allowed"
    assert "GET" in r.headers["allow"]


async def test_validation_error_is_422_with_failing_fields(error_client):
    r = await error_client.get("/_t/typed", params={"n": "abc"})
    assert r.status_code == 422
    body = r.json()
    assert body["error"]["code"] == "validation_error"
    assert "query.n" in body["error"]["message"]
    assert set(body) == {"error"}


async def test_validation_error_does_not_echo_input(error_client):
    r = await error_client.post("/_t/login", json={"password": 12345678901})
    assert r.status_code == 422
    assert "12345678901" not in r.text
