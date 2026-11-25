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
  storage.py   Cloudflare R2: signs upload/download links, checks, copies and deletes files
  github.py    reads a public repo once and makes its preview
  projects/    the project feature, split by job:
    models.py    the projects table
    schemas.py   what each endpoint accepts and returns (the API contract)
    service.py   the business rules (upload links, repo preview, creating a project on Render)
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
- The **service** holds every rule ("only a file key this API handed out may be used", "an ongoing
  project has no finish date") and knows nothing about HTTP. It can be tested and reused without a request.
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

### Nothing is stored before Render (Bek, 2026-11-24)

An unfinished form is not wanted: closing the page or pressing F5 must give an empty form. So the
server keeps nothing until "Render project" is pressed:

| Moment | Where the data is |
|---|---|
| typing | only in the browser's memory (React state) |
| video chosen | the file in R2's temporary folder `uploads/`; the browser remembers its key |
| repo link typed | the server reads GitHub and answers a preview; nothing is saved |
| Render pressed | one request with everything; the server writes one row |

- No drafts means no draft code: no autosave queue, no merge rule, no "reopen a draft" address, no
  clean-up job for abandoned drafts.
- Abandoned files stay only in `uploads/`. A lifecycle rule on the bucket (set once in the
  Cloudflare dashboard) deletes anything there after one day, with no code of ours.

### The projects table: one row per published project

- A row is written only on Render, so every row is a published project: `slug` and `published_at`
  are always set (the database enforces it, migration 0002).
- The id is a random UUID chosen by the server before the row is written: the files are copied
  under it first.
- `slug` (the page address, `/projects/reflex`) is made from the name. The database has a unique
  rule on it; if two projects want "reflex" at the same moment, the second one hits that rule, and
  the service retries with "reflex-2". Checking first and then saving would leave a gap between the
  two steps where both could pass.
- Lists (languages, deliverables) are PostgreSQL arrays; the repo preview is JSON (`jsonb`), because it
  is always read and written as one piece.
- **What is required** is one list, `catalog.REQUIRED_FIELDS`. The catalog sends it to the browser,
  which shows the checklist from it; Render checks the same list again on the server. There is no
  second copy of the rule that could drift.

### Uploading a video and creating the project (presigned URLs)

```
1. browser -> API   "I want to upload a video/mp4 of 33,372,331 bytes"
2. API              checks type and size, signs a one-time upload link (15 minutes) for the
                    temporary key uploads/<random>/video.mp4
3. browser -> R2    uploads the file straight to R2 with that link (progress bar); the preview on
                    the page plays the person's own file from memory
   ... the person finishes the form ...
4. browser -> API   Render: every field, the video and poster keys, the repo link (one request)
5. API              checks the fields; the keys must look like keys it handed out; looks at R2 to
                    see the video is really there with an allowed type and size; reads GitHub;
                    copies the files inside R2 to videos/<project id>/ and posters/<project id>/;
                    writes the row; deletes the temporary originals
```

- **Why not through our server:** a Vercel function accepts at most 4.5 MB per request and a Modal
  request may last at most 150 s; a 300 MB video breaks both, and the traffic would be paid twice.
- **What the signature locks:** the link is valid for one file name, one content type and one exact
  size. Verified on R2: a different size or type is refused with 403.
- **Step 5 never trusts the browser:** the browser could send a key it did not upload, or someone
  else's published video, so the API accepts only `uploads/...` keys and looks at R2 itself.
- **Why copy instead of keeping the temporary key:** the lifecycle rule empties `uploads/` after a
  day; a published video must live outside it. The copy happens inside R2 (no download).
- **If something fails in step 5** (GitHub down, database error), the copies are deleted and no row
  is written; the temporary files stay, so pressing Render again works.
- **Watching a video:** the bucket is private. Each project answer contains fresh download links,
  valid for one hour, so a link that leaks stops working. Seeking works because R2 answers "give
  me bytes 1000-2000" requests (verified: 206 Partial Content).
- **boto3 and async:** boto3 (the S3 library) is not async. Signing a link is pure computation and
  is fine, but checking or deleting a file is a network call. It runs in a worker thread
  (`asyncio.to_thread`), so one slow R2 call does not freeze every other request.

### Repository preview

The repository is optional (D25). When a repo link is typed, the API reads it from GitHub (repo
info, root folder list, README) and answers a preview without storing it. On Render, if a link was
sent, the API reads GitHub again itself (the browser's
preview is never trusted) and stores the small preview with the project. Showing a project never
calls GitHub: GitHub allows only 60
anonymous requests per hour from one server address, and an optional `GITHUB_API_TOKEN` raises that to
5,000 (useful on Modal, whose outgoing addresses may be shared with other users).

### No caching of API answers

Every `/api` answer carries `Cache-Control: no-store` (`main.py`). The answers contain upload and
download links that expire, and on Vercel they pass through a proxy. A cached answer could hand out
dead links, or one person's upload link to another.

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

### Two ways the frontend gets data

- **From the browser** (the upload page, which is interactive): `fetch("/api/v1/...")` to the same
  site; Next.js forwards it to FastAPI (the rewrite). No CORS, one address.
- **From the server** (the project page, rendered before it reaches the browser): server components
  call FastAPI directly at `API_URL` (`src/lib/server-api.ts`). The request never leaves the server
  side, so the rewrite is not needed.
- The rewrite's target is fixed when the frontend is **built**; `API_URL` must be set before a build
  (on Vercel: before the push that triggers it).

### Cache Components and the project page

- A page is static unless it reads per-request data. The project page reads its address
  (`/projects/<slug>`) and fresh project data, so that part sits inside `<Suspense>`: the shell
  (header) is sent at once, the content streams in. The build shows it as "Partial Prerender".
- Nothing on it is cached: every request gets fresh signed video links.
- An unknown address shows the not-found page. Because the response has already started streaming,
  the status stays 200; Next.js adds `noindex` so search engines do not keep it (documented
  behaviour, `node_modules/next/dist/docs/.../not-found.md`).

### The upload page: the form lives in the browser (`src/lib/use-project-form.ts`)

- **State.** The typed fields, the uploaded video (its temporary key, name, size, length), the
  repo preview and the text typed in the repo box are React state. The repo text lives here, not in
  the repository card, so Render can refuse a link that is typed but not checked yet (`repoPending`). The header's
  "N of 5 ready" bar (D29) is computed from them and the catalog's `required_fields`, with the server's blank
  rule (spaces only = empty); `components/editor/sections.ts` groups the fields into the five parts.
- **Edit in place (D29).** The upload page draws the project page itself: the shared pieces live in
  `components/page/parts.tsx`, and every value is a field in its own place. Editing cues are outlines
  (`.ed`, `.pick` in `globals.css`), never borders or padding changes, so typing or focusing moves nothing.
- **Leaving the page empties it.** F5 or closing the tab: the browser's memory is gone. Moving to
  another page of the site: Next.js keeps the page hidden (React `Activity`) and would show the old
  form on return, so a `useLayoutEffect` clean-up resets the state when the page is hidden
  (`node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`).
- **Render.** One request with everything. A ref (not state) blocks a second click before React
  re-renders the button; after success the lock stays on until the page is left, so one form can
  create only one project.
- **Dates.** The two date rules are checked while typing and shown on the date fields; the server
  checks them again on Render.

### The upload page: sending the video

- The browser reads the chosen file locally first: its length, and its first frame drawn onto a
  canvas and saved as a JPEG (the poster). If the browser cannot read the file within 10 s, the
  video is uploaded without a poster instead of waiting forever.
- The upload to R2 uses `XMLHttpRequest`, not `fetch`, because only XHR reports upload progress
  (the progress bar).
- The video counts as uploaded only after its poster upload has finished (or failed), so Render
  cannot run in between and save the project without its still image.
- The preview plays the person's own file from memory (`URL.createObjectURL`), so nothing is
  downloaded back from R2 and no signed link can expire on this page.

### The project page video

The video box (`src/components/project/demo-player.tsx`) uses the browser's own controls from the
start (D28). The video never starts by itself; at the end it returns to its first frame. If the page
has been open for more than 50 minutes, pressing play first asks the API for fresh links
(`/projects/by-slug/<slug>/video`). React alone sets the video's `src`; setting it by hand as well
would make the browser load the video twice and stop playback.

## 4. Running it locally

```
docker compose up -d                       # PostgreSQL
cd backend && uv run uvicorn app.main:app  # API on http://127.0.0.1:8000
cd frontend && npm run dev                 # site on http://localhost:3000
```

Check: http://localhost:3000/api/health answers `{"status":"ok","database":"ok"}`. That one answer
proves the whole chain: browser, Next.js forwarding, FastAPI, PostgreSQL.
