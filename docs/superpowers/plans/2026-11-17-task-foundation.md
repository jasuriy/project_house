# Task F: Backend foundation

Branch: `foundation`. Must be done and reviewed before Tasks A and B start.
Read first: `docs/architecture.md`, `docs/agent-rules.md`.
Test database: `projecthouse_test_foundation` on the running Postgres at 127.0.0.1:55432
(user `projecthouse`, password `projecthouse_dev`). Do not start or stop Docker containers.

## Goal

The shared plumbing every feature builds on, so Tasks A and B never touch shared files except one
registration line each.

## Deliverables

1. **Package layout** per architecture section 2. Move the health endpoint to
   `app/health/router.py` (same URL `/api/health`, same behaviour, tests kept green).
2. **`app/core/config.py`**: `Settings` with `app_env: Literal["development","test","production"]`,
   `database_url`, `secret_key`, `public_base_url`, `cors_origins`. In production `database_url`
   and `secret_key` have no default: constructing Settings with `APP_ENV=production` and either
   missing raises a validation error. Dev defaults as in architecture section 3.
3. **`app/core/db.py`**: `Base` (DeclarativeBase) with this naming convention:
   `ix: ix_%(column_0_label)s`, `uq: uq_%(table_name)s_%(column_0_name)s`,
   `ck: ck_%(table_name)s_%(constraint_name)s`, `fk: fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s`,
   `pk: pk_%(table_name)s`. `get_engine()` (cached, `pool_pre_ping=True`), `get_session()` FastAPI
   dependency yielding an `AsyncSession` (services commit explicitly), `dispose_engine()`, and the
   existing `database_is_up()` unchanged in behaviour. `create_app()` uses a lifespan that calls
   `dispose_engine()` on shutdown.
4. **`app/core/errors.py`**: `AppError(status: int, code: str, message: str)` and handlers so that
   `AppError`, `HTTPException` and `RequestValidationError` all return
   `{"error": {"code": ..., "message": ...}}` (validation keeps 422, code `validation_error`,
   message lists the failing fields).
5. **`app/core/pagination.py`**: `encode_cursor(published_at: datetime, id: int) -> str` and
   `decode_cursor(cursor: str) -> tuple[datetime, int]` (URL-safe base64 of JSON; tz-aware UTC);
   a malformed cursor raises `AppError(400, "invalid_cursor", ...)`.
6. **`app/core/models_registry.py`**: imports every feature's `models` module so Alembic sees all
   tables. Tasks A and B each add one import line here.
7. **`app/users/`**: `models.User` exactly as the `users` row in architecture section 4 (with
   CHECK constraints for username pattern and account_type); `usernames.py` with
   `RESERVED_USERNAMES` (architecture list) and `validate_username(name: str) -> None` raising
   `AppError(422, "invalid_username", ...)`; `schemas.UserPublic`; service functions
   `get_by_id(session, user_id)`, `get_by_username(session, username)`,
   `username_exists(session, username) -> bool`, and
   `create_user(session, *, username, display_name, account_type) -> User` (validates the username,
   raises `AppError(409, "username_taken", ...)`, flushes but does not commit, so a caller such as
   signup can commit it together with its own rows);
   `router.py`: `GET /api/v1/users/{username}` returns `UserPublic` or 404 `user_not_found`.
8. **Alembic** in `backend/alembic/` with an async `env.py` reading `Settings().database_url` and
   `Base.metadata` via `models_registry`. First migration: `users` table. `alembic.ini` in `backend/`.
9. **Test fixtures** (`backend/tests/conftest.py`): read `TEST_DATABASE_URL` (fail with a clear
   message if unset); session-scoped: create the database if missing (connect to `postgres` db),
   run `alembic upgrade head`; per test: `NullPool` engine, `get_session` overridden to it, and all
   tables except `alembic_version` truncated after each test (`TRUNCATE ... RESTART IDENTITY
   CASCADE`). Fixtures: `client` (httpx AsyncClient on the app), `db_session`.
10. **CI** (`.github/workflows/ci.yml` backend job): set `TEST_DATABASE_URL`, run
    `alembic heads` and fail unless exactly one head, run `alembic upgrade head` on the service DB,
    then ruff and pytest.
11. **Frontend dev routing**: `frontend/next.config.ts` rewrites `/api/:path*` to
    `${API_URL}/api/:path*` (default `http://localhost:8000`), keeping `output: "standalone"` and
    the next-intl plugin.
12. **`.env.example`**: add `APP_ENV=development`, `SECRET_KEY=dev-only-change-me`,
    `PUBLIC_BASE_URL=http://localhost:3000`, `TEST_DATABASE_URL=...projecthouse_test`.

## Tests that must exist (write first)

- Settings: production without `DATABASE_URL` raises; production without `SECRET_KEY` raises;
  development has defaults.
- Error shape: an endpoint raising `AppError` returns the shape; unknown route 404 returns the
  shape; a validation error returns 422 with code `validation_error`.
- Cursor: round trip equals input; malformed cursor -> 400 `invalid_cursor`.
- Users: `validate_username` rejects `a.b`, `uz`, `demo`, `AB`, `ab` (too short), accepts
  `aziz-rahimov`; DB rejects an uppercase username insert (CHECK constraint); `GET
  /api/v1/users/{username}` 200 for an inserted user, 404 shape otherwise.
- Migrations: `alembic upgrade head` then `alembic downgrade base` then `upgrade head` succeeds.
- Health: existing tests still pass at `/api/health`.

## Out of scope

Auth, projects, any frontend page. Do not create auth or project tables.
