# Prostagram

Share your projects: a demo video, the problem and outcome, the tech stack, the code and how to run it,
all on one page.

- Product spec: `docs/specs/2026-11-23-prostagram-upload-and-project-pages.md`
- How it is built and why: `docs/architecture.md`
- Design mockups: `docs/mockups/`

## Run locally

Needs Docker, [uv](https://docs.astral.sh/uv/) and Node.js.

```
docker compose up -d
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

cd backend && uv run uvicorn app.main:app      # http://127.0.0.1:8000
cd frontend && npm install && npm run dev      # http://localhost:3000
```

## Checks

```
cd backend && uv run pytest && uv run ruff check . && uv run ruff format --check .
cd frontend && npm run lint && npm run build
```
