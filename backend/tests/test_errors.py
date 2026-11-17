import logging
from collections.abc import AsyncIterator

import pytest
from fastapi import HTTPException
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

    @app.get("/_t/boom")
    async def boom() -> None:
        raise RuntimeError("secret internal detail")

    @app.get("/_t/dict-detail")
    async def dict_detail() -> None:
        raise HTTPException(403, detail={"secret": "internal"})

    @app.get("/_t/str-detail")
    async def str_detail() -> None:
        raise HTTPException(409, detail="Custom message")

    @app.post("/_t/login")
    async def login(body: dict[str, str]) -> None: ...

    # raise_app_exceptions=False: return the 500 response instead of re-raising in the test.
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
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


async def test_unhandled_exception_returns_500_shape_without_leaking(error_client, caplog):
    with caplog.at_level(logging.ERROR):
        r = await error_client.get("/_t/boom")
    assert r.status_code == 500
    assert r.json() == {"error": {"code": "internal_error", "message": "Internal server error"}}
    assert "secret internal detail" not in r.text
    logged = [rec for rec in caplog.records if rec.exc_info and rec.exc_info[0] is RuntimeError]
    assert logged, "the exception must be logged with its traceback"


async def test_non_string_http_detail_gets_generic_message(error_client):
    r = await error_client.get("/_t/dict-detail")
    assert r.status_code == 403
    assert r.json() == {"error": {"code": "forbidden", "message": "Forbidden"}}
    assert "secret" not in r.text


async def test_string_http_detail_is_kept(error_client):
    r = await error_client.get("/_t/str-detail")
    assert r.json() == {"error": {"code": "conflict", "message": "Custom message"}}
