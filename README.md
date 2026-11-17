# Project House

"Instagram where every post is a project". Developers create a profile and publish projects as
clean, fixed-format cards; companies browse them and message the developers they want to hire.
Full design: [docs/superpowers/specs/2026-11-17-project-house-design.md](docs/superpowers/specs/2026-11-17-project-house-design.md).

This repository is at Step 0: a runnable skeleton (FastAPI backend, Next.js frontend with
uz/ru/en locales, PostgreSQL) that shows the backend status on the home page.

## Prerequisites

- Docker Desktop (Compose v2)
- Node 24+ (frontend development and tests)
- Python 3.11+ (backend development and tests)

## Run everything with Docker

PowerShell (use `curl.exe`; plain `curl` is an alias for `Invoke-WebRequest` in Windows PowerShell 5.1):

```powershell
Copy-Item .env.example .env
docker compose up --build -d
curl.exe http://localhost:8000/api/health
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/uz
```

Bash / macOS / Linux:

```bash
cp .env.example .env
docker compose up --build -d
curl http://localhost:8000/api/health
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/uz
```

Expected: `{"status":"ok","database":"ok"}` and `200`. Then open
<http://localhost:3000/uz>, `/ru` and `/en`: each page shows its language and an "OK" status.

Stop with `docker compose down` (the database volume `pgdata` is kept; add `-v` to delete it).

Ports: frontend 3000, backend 8000, PostgreSQL 5432 (bound to 127.0.0.1 only). If another
PostgreSQL already uses port 5432 on your machine, `docker compose up` fails with
"ports are not available".

## Tests

Backend (from `backend/`):

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements-dev.txt
.venv\Scripts\pytest -v
```

On Linux/macOS use `.venv/bin/pip` and `.venv/bin/pytest`. One test needs a real database and is
skipped unless `DATABASE_URL` is set. To run it against the Compose database, start the stack and
set `DATABASE_URL` to `postgresql+asyncpg://projecthouse:projecthouse_dev@127.0.0.1:5432/projecthouse`
(values from `.env.example`; on Windows prefer `127.0.0.1` over `localhost`).

Frontend (from `frontend/`):

```powershell
npm ci
npm test
npm run lint
npm run build
```
