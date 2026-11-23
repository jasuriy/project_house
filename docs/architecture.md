# Prostagram architecture

Written so the owner can explain every part in an interview. Updated with every step.
Product decisions live in `docs/specs/`. This file explains how the system is built and why.

## 1. The big picture

```
browser
   |  every request goes to ONE address (the Next.js site)
   v
Next.js (frontend/)            pages, forms; /api/* is forwarded, not handled here
   |  /api/*  -> forwarded ("rewrite") to the backend
   v
FastAPI (backend/)             business rules, validation, database, signing R2 links
   |
   +--> PostgreSQL             projects and their data (local: Docker; production: Neon)
   +--> Cloudflare R2          video files (later step; the browser uploads straight to R2)
   +--> GitHub API             repository preview (later step)
```

Where it runs in production (from push day): Next.js on Vercel, FastAPI on Modal, PostgreSQL on Neon,
files on Cloudflare R2.

### Why one address for the browser

The browser only ever talks to the Next.js site. When it asks for `/api/health`, Next.js forwards the
request to FastAPI and passes the answer back (`frontend/next.config.ts`, `rewrites`).

- **No CORS.** Browsers block a page from calling another domain unless that domain allows it
  (CORS rules). With one address there is nothing to allow and nothing to get wrong.
- **Login later is simpler.** A login cookie set on one domain is sent automatically with every
  request. Two domains would need cross-site cookie settings.
- **The exception is video.** A video of up to 300 MB is uploaded by the browser straight to R2,
  never through Next.js or FastAPI (spec section 7).

## 2. Backend (`backend/`)

Python 3.13, FastAPI, SQLAlchemy 2 (async), Alembic, PostgreSQL. Packages are pinned to exact
versions in `pyproject.toml` and locked in `uv.lock`, so every machine installs the same thing.

```
backend/app/
  main.py      builds the app: error handlers, routers, "no-store", closing DB connections
  config.py    settings from environment variables (and backend/.env in development)
  db.py        database engine, one session per request, base class for tables
  errors.py    turns every error into one JSON shape
  health.py    GET /api/health
  catalog.py   every fixed list, text limit, upload rule and the tech catalog; GET /api/v1/catalog
  storage.py   Cloudflare R2: signs upload/download links, checks and deletes files
  github.py    reads a public repo once and makes its preview
  projects/    the project feature, split by job:
    models.py    the projects table
    schemas.py   what each endpoint accepts and returns (the API contract)
    service.py   the business rules (drafts, uploads, repo, publishing)
    router.py    HTTP only: read the request, call the service, return the answer
backend/alembic/   database migrations (versioned changes to the tables)
backend/tests/     tests that run against a real PostgreSQL test database
```

### Layers inside a feature

```
router.py  ->  service.py  ->  models.py (database)
  HTTP          rules            tables
```

- The **router** knows HTTP (paths, status codes) and nothing about rules.
- The **service** holds every rule ("a published project cannot be changed", "an ongoing project
  has no finish date") and knows nothing about HTTP. It can be tested and reused without a request.
- **Who saves to the database:** each public service function is one unit of work and calls
  `commit` itself, at its end. Routers never commit. One rule means every change is saved exactly once,
  and a function that fails halfway saves nothing.
- Outside services (R2, GitHub) reach the service as parameters. The router gets them from
  FastAPI (`Depends(get_storage)`), and tests swap in fakes (`app.dependency_overrides`), with no
  code change in the service.

### How one request flows

1. A request arrives, for example `GET /api/health`.
2. FastAPI finds the matching function (a "route") in a router.
3. The route asks for what it needs as parameters, for example a database session
   (`Depends(get_session)`). FastAPI creates it, and closes it when the request ends. This is
   "dependency injection": the route does not build its own tools, it receives them, so tests can
   hand it fake ones.
4. The route returns data; FastAPI turns it into JSON.
5. If anything goes wrong, an error handler turns it into the error shape below.

### One error shape

Every error, from any route, looks the same:

```json
{"error": {"code": "not_found", "message": "Not Found"}}
```

- `code` is stable and meant for code (the frontend can react to `"video_too_large"`).
- `message` is meant for people.
- Expected errors are raised as `AppError(status, code, message)`. Wrong input is 422
  `validation_error`. Anything unexpected is logged and answered with 500 `internal_error`, so
  internal details never leak to the browser.

Why: the frontend needs one place that shows errors, not one per endpoint.

### Settings and secrets

`config.py` reads settings from environment variables. In development they come from
`backend/.env` (copied from `backend/.env.example`; never committed).

- `DATABASE_URL` has **no default**. If it is missing, the app refuses to start. A default would
  let production silently connect to a development database.
- The backend reads only `backend/.env`, never the `.env` in the repository root. The root file
  belongs to the old app and points at the old database.

### Database

- Local PostgreSQL 18 runs in Docker (`docker-compose.yml`, port 55433). Production uses Neon,
  also PostgreSQL 18, so local and production behave the same.
- Two databases: `prostagram` for development, `prostagram_test` for tests, so tests never
  touch development data.
- **Migrations (Alembic):** the tables are never changed by hand. Each change is a numbered
  migration file with an `upgrade` (apply) and a `downgrade` (undo). The database remembers which
  migrations ran, so every environment can be brought to the same state with
  `uv run alembic upgrade head`.
- **Connection pool:** opening a database connection is slow, so the engine keeps a few open
  and lends them to requests. `pool_pre_ping` checks a connection is still alive before lending
  it (Neon closes idle connections). On shutdown the pool is closed (`main.py`, `lifespan`).
- Constraint names follow a fixed pattern (`db.py`, `NAMING_CONVENTION`), so migrations are
  readable and the same on every machine.

### The projects table: draft and published in one row

- A project is created empty when the person starts typing, and every change is saved
  ("autosave", `PATCH /api/v1/projects/{id}`). There is no separate drafts table.
- `published_at` is the only switch: empty means draft, a time means published. A second
  "state" column would duplicate it and could disagree with it.
- The id is a random UUID: without login, a counting number (1, 2, 3...) would let anyone open other
  people's drafts by guessing.
- `slug` (the page address, `/projects/reflex`) is set when publishing, made from the name. The
  database has a unique rule on it; if two projects want "reflex" at the same moment, the second one
  hits that rule, and the service retries with "reflex-2". Checking first and then saving would leave
  a gap between the two steps where both could pass.
- Lists (languages, deliverables) are PostgreSQL arrays; the repo preview is JSON (`jsonb`), because it
  is always read and written as one piece.
- **What is required** is decided in one place, `service.missing_fields()`. Every project answer
  includes that list, the upload page shows it, and publishing checks it again. The frontend
  has no copy of the rule that could drift.

### Uploading a video (presigned URLs)

```
1. browser -> API   "I want to upload reflex-demo.mp4, video/mp4, 33,372,331 bytes"
2. API              checks type and size, signs a one-time upload link (15 minutes)
3. browser -> R2    uploads the file straight to R2 with that link (progress bar)
4. browser -> API   "done"
5. API -> R2        checks the file is really there, with the right size and type,
                    then saves its key on the project (and deletes the replaced video)
```

- **Why not through our server:** a Vercel function accepts at most 4.5 MB per request and a Modal
  request may last at most 150 s; a 300 MB video breaks both, and the traffic would be paid twice.
- **What the signature locks:** the link is valid for one file name, one content type and one exact
  size. Verified on R2: a different size or type is refused with 403.
- **Step 5 is still needed:** the browser could skip the upload or send something else, so the API
  never trusts the browser's "done" without looking at R2 itself.
- **Watching a video:** the bucket is private. Each project answer contains fresh download links,
  valid for one hour, so a link that leaks stops working. Seeking works because R2 answers "give
  me bytes 1000-2000" requests (verified: 206 Partial Content).
- **boto3 and async:** boto3 (the S3 library) is not async. Signing a link is pure computation and
  is fine, but checking or deleting a file is a network call. It runs in a worker thread
  (`asyncio.to_thread`), so one slow R2 call does not freeze every other request.

### Repository preview

When a repo is linked, the API reads it from GitHub once (repo info, root folder list, README) and
stores a small preview with the project. Showing a project never calls GitHub: GitHub allows only 60
anonymous requests per hour from one server address, and an optional `GITHUB_TOKEN` raises that to
5,000 (useful on Modal, whose outgoing addresses may be shared with other users).

### No caching of API answers

Every `/api` answer carries `Cache-Control: no-store` (`main.py`). The answers contain download links
that expire after an hour and drafts that change every second, and on Vercel they pass through a
proxy. A cached answer could hand out dead links or one person's draft to another.

### Tests

- `uv run pytest` runs the tests against the real `prostagram_test` database. Real PostgreSQL,
  not a fake: a fake database can hide real problems (types, constraints, SQL differences).
- External services (R2, GitHub) are replaced with fakes in tests, because tests must not depend on
  the internet or cost money.
- `uv run ruff check .` and `uv run ruff format --check .` keep the code style consistent.

## 3. Frontend (`frontend/`)

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.

- **Tailwind CSS:** styles are written as small classes directly on elements
  (`class="rounded-xl p-4"`). Chosen because matching a pixel-exact mockup means many small,
  local style decisions; with Tailwind they sit next to the element they style instead of in a
  separate stylesheet.
- **Cache Components** (on by default in this Next.js version): a page is computed fresh on every
  request unless code explicitly marks something as cacheable with `"use cache"`. We never cache the
  project page, because it carries video links that expire after one hour.
- `API_URL` (in `frontend/.env.local`, from `.env.example`) tells Next.js where FastAPI runs.

## 4. Running it locally

```
docker compose up -d                       # PostgreSQL
cd backend && uv run uvicorn app.main:app  # API on http://127.0.0.1:8000
cd frontend && npm run dev                 # site on http://localhost:3000
```

Check: http://localhost:3000/api/health answers `{"status":"ok","database":"ok"}`. That one answer
proves the whole chain: browser, Next.js forwarding, FastAPI, PostgreSQL.
