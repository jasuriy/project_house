import logging
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

_HTTP_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "validation_error",
    429: "too_many_requests",
}


class AppError(Exception):
    """An expected failure with an HTTP status and a stable machine-readable code."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def _error_response(
    status: int, code: str, message: str, headers: dict[str, str] | None = None
) -> JSONResponse:
    return JSONResponse(
        {"error": {"code": code, "message": message}}, status_code=status, headers=headers
    )


async def _handle_app_error(_: Request, exc: AppError) -> JSONResponse:
    return _error_response(exc.status, exc.code, exc.message)


async def _handle_http_exception(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = _HTTP_CODES.get(exc.status_code, "http_error")
    if isinstance(exc.detail, str):
        message = exc.detail
    else:
        # Structured details are not part of our error shape and may carry internals.
        message = _generic_message(exc.status_code)
    return _error_response(exc.status_code, code, message, exc.headers)


def _generic_message(status: int) -> str:
    try:
        return HTTPStatus(status).phrase
    except ValueError:
        return "Error"


async def _handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    # Never put exception text in the response; the traceback goes to the server log only.
    logger.error("Unhandled exception", exc_info=exc)
    return _error_response(500, "internal_error", "Internal server error")


async def _handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    # Field locations and messages only: FastAPI's default body echoes the submitted input,
    # which can be a password.
    failures = [
        f"{'.'.join(str(part) for part in err['loc'])}: {err['msg']}" for err in exc.errors()
    ]
    return _error_response(422, "validation_error", "; ".join(failures))


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _handle_app_error)
    # Starlette's class, not FastAPI's subclass: the router raises Starlette's for unknown routes.
    app.add_exception_handler(StarletteHTTPException, _handle_http_exception)
    app.add_exception_handler(RequestValidationError, _handle_validation_error)
    app.add_exception_handler(Exception, _handle_unexpected_error)
