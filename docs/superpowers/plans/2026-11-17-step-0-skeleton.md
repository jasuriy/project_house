# Step 0 - Project Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An empty but working project: a FastAPI backend that reports its own and the database's health, a Next.js frontend that shows a hello page in Uzbek, Russian and English and displays the backend's status, all started with one `docker compose up`, and checked by GitHub Actions on every push.

**Architecture:** Monorepo with `backend/` (FastAPI, Python) and `frontend/` (Next.js App Router, TypeScript), plus PostgreSQL, wired by `docker-compose.yml`. Login (Step 1) will live in the backend (decision X); nothing about login is built here. Server deploy, HTTPS and backups are **Step 0b**, planned separately once Bek picks a server.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2 (async) + asyncpg, pydantic-settings, pytest + httpx, ruff. Node 24 LTS, Next.js 16, next-intl 4.14, Vitest, ESLint. PostgreSQL 17. Docker Compose. GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-17-project-house-design.md` (sections 5 D10, D13; 7; 11 step 0)

## Global Constraints

- Locales, in this order: `uz`, `ru`, `en`. Default locale: `uz` (Uzbek, Latin script). Every URL carries the locale prefix (`/uz`, `/ru`, `/en`).
- Python code must run on 3.11+ (Bek's machine has 3.11.9); Docker and CI use 3.12.
- Node 24 in Docker and CI. npm is the package manager (pnpm is not installed).
- Direct dependencies pinned to exact versions (`==` in Python, exact in `package-lock.json`).
- No secrets in git. `.env` is ignored; `.env.example` holds safe dev defaults only.
- All text files use LF line endings (`.gitattributes`), so shell and Docker files work inside Linux containers on a Windows checkout.
- No emoji anywhere (code, comments, commits, docs).
- Work on branch `step-0-skeleton`; merge to `main` only when CI is green.

## Review Focus

1. **A translation key missing in one language** -> the page shows a raw key. Pinned by the message-parity test (Task 2).
2. **Unknown locale in the URL (`/de`)** -> must give 404, not a crash or a wrong-language page. Pinned in Task 2 (routing config test) and Task 3 (manual curl).
3. **Database down** -> `/api/health` must answer 503 with `"database": "unreachable"`, not a 500 stack trace. Pinned in Task 1.
4. **Backend down** -> the frontend page must still render and say the backend is unreachable. Pinned in Task 2 (`fetchBackendStatus` test).
5. **CRLF line endings from Windows** break scripts in Linux containers. Pinned by `.gitattributes` (Task 1) and the CI Docker build job (Task 4).

---

## File Structure

```
.gitattributes, .gitignore, .env.example, README.md, docker-compose.yml
.github/workflows/ci.yml
backend/
  pyproject.toml            ruff + pytest config
  requirements.txt          runtime deps (pinned)
  requirements-dev.txt      -r requirements.txt + pytest, httpx, ruff
  Dockerfile
  app/__init__.py
  app/main.py               create_app(), app
  app/config.py             Settings, get_settings()
  app/db.py                 engine, database_is_up()
  app/api/__init__.py
  app/api/health.py         GET /api/health
  tests/conftest.py         client fixture
  tests/test_health.py
frontend/                   (created by create-next-app, then edited)
  next.config.ts            standalone output + next-intl plugin
  src/proxy.ts              next-intl locale routing
  src/i18n/routing.ts       locales, defaultLocale
  src/i18n/request.ts       loads messages/<locale>.json
  src/lib/backend.ts        fetchBackendStatus()
  src/app/[locale]/layout.tsx
  src/app/[locale]/page.tsx hello page
  messages/uz.json, ru.json, en.json
  tests/messages.test.ts, tests/routing.test.ts, tests/backend.test.ts
  vitest.config.ts
  Dockerfile
```

---

### Task 1: Backend skeleton with health check

**Files:**
- Create: `.gitattributes`, `.gitignore`, `.env.example`, `backend/pyproject.toml`, `backend/requirements.txt`, `backend/requirements-dev.txt`, `backend/app/__init__.py`, `backend/app/main.py`, `backend/app/config.py`, `backend/app/db.py`, `backend/app/api/__init__.py`, `backend/app/api/health.py`
- Test: `backend/tests/conftest.py`, `backend/tests/test_health.py`

**Interfaces:**
- Produces:
  - `app.config.Settings` (pydantic-settings, reads env): `database_url: str`, `cors_origins: list[str] = ["http://localhost:3000"]`
  - `app.config.get_settings() -> Settings` (cached with `functools.lru_cache`)
  - `app.db.get_engine() -> AsyncEngine`: created lazily from `get_settings().database_url`, cached with `functools.lru_cache` (so tests can `cache_clear()` it).
  - `app.db.database_is_up() -> bool` (async): runs `SELECT 1` on `get_engine()` with a 2-second timeout; returns `False` on any `SQLAlchemyError`, `OSError` or timeout; never raises.
  - `app.main.create_app() -> FastAPI`; module-level `app = create_app()`
  - `GET /api/health` -> 200 `{"status": "ok", "database": "ok"}` or 503 `{"status": "degraded", "database": "unreachable"}`
  - Env var names: `DATABASE_URL` (format `postgresql+asyncpg://user:pass@host:5432/db`), `CORS_ORIGINS` (JSON list)

- [ ] **Step 1: Branch and repo hygiene files**

```bash
git checkout -b step-0-skeleton
```
`.gitattributes`: `* text=auto eol=lf`. `.gitignore`: Python (`__pycache__/`, `.venv/`, `.pytest_cache/`, `.ruff_cache/`), Node (`node_modules/`, `.next/`), `.env`. `.env.example`:
```
POSTGRES_USER=projecthouse
POSTGRES_PASSWORD=projecthouse_dev
POSTGRES_DB=projecthouse
DATABASE_URL=postgresql+asyncpg://projecthouse:projecthouse_dev@localhost:5432/projecthouse
CORS_ORIGINS=["http://localhost:3000"]
```

- [ ] **Step 2: Dependencies and tool config**

`requirements.txt`: fastapi, uvicorn[standard], sqlalchemy[asyncio], asyncpg, pydantic-settings, each pinned `==` to the latest stable release at install time. `requirements-dev.txt`: `-r requirements.txt`, pytest, pytest-asyncio, httpx, ruff (pinned). `pyproject.toml`: `[tool.ruff] target-version = "py311"`, `line-length = 100`; `[tool.pytest.ini_options] asyncio_mode = "auto"`, `testpaths = ["tests"]`.

Create a local venv and install: `cd backend; python -m venv .venv; .venv\Scripts\pip install -r requirements-dev.txt`

- [ ] **Step 3: Write the failing tests** (`backend/tests/test_health.py`)

```python
from app.db import database_is_up
from app.main import app


async def test_health_ok_when_database_up(client):
    app.dependency_overrides[database_is_up] = lambda: True
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "database": "ok"}


async def test_health_503_when_database_down(client):
    app.dependency_overrides[database_is_up] = lambda: False
    r = await client.get("/api/health")
    assert r.status_code == 503
    assert r.json() == {"status": "degraded", "database": "unreachable"}


async def test_database_is_up_false_for_unreachable_host(monkeypatch, fresh_settings):
    # Port 1 on localhost: nothing listens there, connection is refused fast.
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@127.0.0.1:1/x")
    assert await database_is_up() is False


@pytest.mark.skipif(not os.getenv("DATABASE_URL"), reason="needs a real Postgres")
async def test_database_is_up_true_with_real_database(fresh_settings):
    # Runs in CI (Postgres service) and locally when DATABASE_URL points at the compose db.
    assert await database_is_up() is True
```
`conftest.py`:
- async fixture `client` yielding `httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")`, clearing `app.dependency_overrides` afterwards.
- fixture `fresh_settings`: calls `get_settings.cache_clear()` and `get_engine.cache_clear()` before and after the test, so the engine is rebuilt from the current env.

- [ ] **Step 4: Run tests, expect failure**

Run: `cd backend; .venv\Scripts\pytest -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app'` (or import errors).

- [ ] **Step 5: Implement `config.py`, `db.py`, `api/health.py`, `main.py`** per the Interfaces block. `main.py` adds `CORSMiddleware` with `settings.cors_origins` and includes the health router.

- [ ] **Step 6: Run tests and lint, expect pass**

Run: `.venv\Scripts\pytest -v; .venv\Scripts\ruff check .; .venv\Scripts\ruff format --check .`
Expected: 3 passed, 1 skipped (no `DATABASE_URL` in the shell); ruff reports no errors. With the compose db running and `$env:DATABASE_URL` set from `.env.example`: 4 passed.

- [ ] **Step 7: Commit**

```bash
git add .gitattributes .gitignore .env.example backend
git commit -m "feat(backend): FastAPI skeleton with database health check"
```

---

### Task 2: Frontend skeleton in three languages

**Files:**
- Create (via create-next-app, then edit): `frontend/` as listed in File Structure
- Test: `frontend/tests/messages.test.ts`, `frontend/tests/routing.test.ts`, `frontend/tests/backend.test.ts`

**Interfaces:**
- Consumes: `GET /api/health` from Task 1 (response shapes above).
- Produces:
  - `src/i18n/routing.ts`: `export const routing = defineRouting({ locales: ['uz', 'ru', 'en'], defaultLocale: 'uz' })`
  - `src/lib/backend.ts`: `export type BackendStatus = 'ok' | 'degraded' | 'unreachable'`; `export async function fetchBackendStatus(baseUrl: string): Promise<BackendStatus>`. 200 -> `'ok'`, 503 -> `'degraded'`, network error, timeout (3 s) or any other status -> `'unreachable'`. Never throws.
  - Env var: `API_URL` (server-side only; `http://localhost:8000` locally, `http://backend:8000` in Compose).
  - Message keys (all three files): `Home.title`, `Home.subtitle`, `Home.backendStatus`, `Status.ok`, `Status.degraded`, `Status.unreachable`.

- [ ] **Step 1: Generate the app**

```bash
npx create-next-app@16 frontend --typescript --eslint --app --src-dir --tailwind --use-npm --import-alias "@/*" --yes
cd frontend; npm install next-intl@4.14; npm install -D vitest
```
Add `"test": "vitest run"` to `package.json` scripts. `vitest.config.ts`: alias `@` -> `./src`, environment `node`.

- [ ] **Step 2: Write the failing tests**

`messages.test.ts`: flatten each JSON file to dotted keys; `expect(keys(uz)).toEqual(keys(en))` and `expect(keys(ru)).toEqual(keys(en))`; and every value is a non-empty string.

`routing.test.ts`:
```ts
expect(routing.locales).toEqual(['uz', 'ru', 'en']);
expect(routing.defaultLocale).toBe('uz');
```

`backend.test.ts` (mock `global.fetch` with `vi.fn`):
- 200 -> `'ok'`; 503 -> `'degraded'`; 500 -> `'unreachable'`; fetch rejects (`TypeError: fetch failed`) -> `'unreachable'`.

- [ ] **Step 3: Run tests, expect failure**

Run: `npm test`
Expected: FAIL, cannot resolve `@/i18n/routing`, `@/lib/backend`, `messages/*.json`.

- [ ] **Step 4: Implement**

- `src/i18n/routing.ts`, `src/i18n/request.ts` (loads `messages/${locale}.json`, falls back to `routing.defaultLocale` for an unknown locale), `src/proxy.ts` (next-intl `createMiddleware(routing)`, matcher `'/((?!api|_next|_vercel|.*\\..*).*)'`), `next.config.ts` (`output: 'standalone'`, wrapped in `createNextIntlPlugin()`), following next-intl 4.14 docs.
- `src/app/[locale]/layout.tsx`: in Next.js 16 `params` is a Promise, so `const {locale} = await params`; `notFound()` if `locale` is not in `routing.locales`; sets `<html lang={locale}>`; wraps children in `NextIntlClientProvider`. Delete the generated `src/app/layout.tsx` and `src/app/page.tsx`.
- `src/app/[locale]/page.tsx`: server component; calls `fetchBackendStatus(process.env.API_URL ?? 'http://localhost:8000')` with `cache: 'no-store'`; renders `Home.title`, `Home.subtitle`, and `Home.backendStatus` + the translated status; links to the other two locales.
- Message copy (Bek may reword later):
  - en: title "Project House", subtitle "Show your work. Get noticed.", backendStatus "Backend status:", ok "OK", degraded "Database unreachable", unreachable "Backend unreachable"
  - uz: title "Project House", subtitle "Ishingizni ko'rsating. E'tiborga tushing.", backendStatus "Backend holati:", ok "Ishlayapti", degraded "Ma'lumotlar bazasi ishlamayapti", unreachable "Backend bilan aloqa yo'q"
  - ru: title "Project House", subtitle "Покажите свою работу. Будьте замечены.", backendStatus "Статус бэкенда:", ok "Работает", degraded "База данных недоступна", unreachable "Бэкенд недоступен"

- [ ] **Step 5: Run tests, lint, build; expect pass**

Run: `npm test; npm run lint; npm run build`
Expected: all tests pass (3 files); lint clean; build succeeds and creates `.next/standalone`.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat(frontend): Next.js skeleton with uz/ru/en locales and backend status"
```

---

### Task 3: Docker Compose - one command starts everything

**Files:**
- Create: `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`, `README.md`

**Interfaces:**
- Consumes: env var names from Tasks 1-2; `.env` copied from `.env.example`.
- Produces: services `db` (postgres:17), `backend` (port 8000), `frontend` (port 3000). Inside Compose the backend reaches the DB at host `db`, the frontend reaches the backend at `http://backend:8000`.

- [ ] **Step 1: Dockerfiles**

- `backend/Dockerfile`: `python:3.12-slim`, install `requirements.txt` only, copy `app/`, run as non-root user, `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`.
- `frontend/Dockerfile`: multi-stage on `node:24-alpine` (deps -> `npm ci`; build -> `npm run build`; run -> copy `.next/standalone`, `.next/static`, `public`, `CMD ["node", "server.js"]`), non-root user, `ENV PORT=3000 HOSTNAME=0.0.0.0`.

- [ ] **Step 2: `docker-compose.yml`**

- `db`: `postgres:17`, env from `.env`, named volume `pgdata`, healthcheck `pg_isready -U $POSTGRES_USER`, port bound to `127.0.0.1:5432:5432` only (so local pytest can reach it, nothing outside the machine can).
- `backend`: build `./backend`, `DATABASE_URL` overridden to host `db`, `depends_on: db: condition: service_healthy`, port `8000:8000`.
- `frontend`: build `./frontend`, `API_URL=http://backend:8000`, `depends_on: backend`, port `3000:3000`.

- [ ] **Step 3: Verify end to end** (Docker Desktop must be running)

PowerShell (use `curl.exe`; plain `curl` is an alias for `Invoke-WebRequest` in Windows PowerShell 5.1):
```powershell
Copy-Item .env.example .env
docker compose up --build -d
curl.exe http://localhost:8000/api/health
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/uz
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/de
```
Expected: `{"status":"ok","database":"ok"}`; `200`; `404`. Open `http://localhost:3000/uz`, `/ru`, `/en` in a browser: each shows its language and "OK" status.

- [ ] **Step 4: Verify failure behaviour**

```powershell
docker compose stop db
curl.exe -i http://localhost:8000/api/health
docker compose stop backend
curl.exe -s http://localhost:3000/en
docker compose up -d
```
Expected: `503` with `"database":"unreachable"`; the `/en` page still renders and contains "Backend unreachable".

- [ ] **Step 5: README.md** - what the project is (one paragraph, link to the spec), prerequisites (Docker Desktop, Node 24+, Python 3.11+), the commands from Step 3, how to run backend and frontend tests locally.

- [ ] **Step 6: Commit**

```bash
git add backend/Dockerfile frontend/Dockerfile docker-compose.yml README.md
git commit -m "feat: docker compose for db, backend and frontend"
```

---

### Task 4: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: commands from Tasks 1-3.
- Produces: three jobs that must all pass before merging to `main`: `backend`, `frontend`, `docker`.

- [ ] **Step 1: Write the workflow.** Triggers: `pull_request` and `push` to `main`.
  - `backend`: `ubuntu-latest`, Python 3.12, service `postgres:17` with health options, `DATABASE_URL` pointing at it; `pip install -r backend/requirements-dev.txt`; `ruff check`, `ruff format --check`, `pytest -v` (working dir `backend`).
  - `frontend`: Node 24, npm cache; `npm ci`, `npm run lint`, `npm test`, `npm run build` (working dir `frontend`).
  - `docker`: `docker compose build` (proves both Dockerfiles build on Linux).

- [ ] **Step 2: Push the branch and open a pull request**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: lint, test and build backend, frontend and docker images"
git push -u origin step-0-skeleton
gh pr create --title "Step 0: project skeleton" --body "<summary of tasks 1-4, link to plan>"
```

- [ ] **Step 3: Verify CI is green**

Run: `gh pr checks --watch`
Expected: `backend`, `frontend`, `docker` all `pass`.

- [ ] **Step 4: Prove CI catches failure** - on the branch, temporarily delete one key from `messages/ru.json`, push, confirm the `frontend` job fails on the parity test, then revert and push again (green).

- [ ] **Step 5: Merge** after Bek approves the PR: `gh pr merge --squash --delete-branch`.

---

## Not in this plan (Step 0b, separate plan after Bek chooses a server)

Server provisioning, HTTPS reverse proxy, automatic deploy on merge, container registry, daily off-server backups with one restore test. The spec's Step 0 "done when" for deploy and backups is met by Step 0b, not here.
