# Follow-ups after Step 0

Source: final whole-branch review of Step 0 (PR #1, 2026-11-17). Items here are deliberately
deferred; each names the step that must handle it.

## Open decision (Bek) - blocks Step 1, not Step 0

**URL scheme for shared links.** The Step 0 plan puts the language in every URL (`/uz/...`).
Spec D2 makes the main output a shareable `<domain>/<username>/<project>` link. Options in
next-intl 4.14 (`localePrefix`): `always` (current), `as-needed` (no prefix for the default
locale `uz`, prefix for `ru`/`en`), `never` (language from cookie only, one URL per page).
Related facts:
- The proxy matcher skips any path containing a dot, so usernames/slugs with a dot would bypass
  locale routing. Either forbid dots in usernames and slugs, or change the matcher.
- Usernames must not collide with locale codes (`uz`, `ru`, `en`) or reserved prefixes (`api`,
  `_next`, `_vercel`).
- With `always`, `/de` currently redirects to `/uz/de` (404). Once profiles exist at
  `/[locale]/[username]`, that becomes a lookup for a user named `de`.

## UI design step - before Step 1

Clickable mockups of feed, project page, profile, add project, messages (phone and desktop);
Bek picks the look; result written down as a short design guide. Remove leftover
create-next-app boilerplate then (`frontend/public/*.svg`, `--font-geist-*` in `globals.css`)
and bump eslint (deprecation warning in CI).

## Step 1, first task - database groundwork

- Dispose the cached SQLAlchemy engine: FastAPI `lifespan` shutdown calls
  `await get_engine().dispose()`; the `fresh_settings` test fixture disposes before `cache_clear()`.
- Choose a DB test strategy (NullPool in tests, or a session-scoped event loop) before adding
  many DB tests; asyncpg connections are bound to the loop that created them.
- Consider `pool_pre_ping=True` so a DB restart does not surface as errors on the first requests.
- Optional: `response_model` on `/api/health`; Python 3.11 in the CI matrix (contract is 3.11+).

## Step 0b - server deploy checklist

- `DATABASE_URL` required in production (no silent dev default), with a non-dev password.
- Do not publish backend 8000 / frontend 3000 directly; only the HTTPS reverse proxy is public
  (Docker-published ports bypass ufw on Linux).
- Use `/api/health` as a readiness check, not a liveness restart trigger.
- CD smoke test: `docker compose up` + curl health and one page.
- Drop `env_file: .env` from the backend service (it receives unused `POSTGRES_*`).
- CI hardening: `timeout-minutes` per job, `concurrency` with `cancel-in-progress`.

## Repository setting (Bek)

Branch protection on `main` requiring the `backend`, `frontend` and `docker` checks.
