# Project House architecture (Phase 1)

Status: binding for all implementation work from 2026-11-17. Changes need a written reason here.
Spec: `docs/superpowers/specs/2026-11-17-project-house-design.md`. Agent rules: `docs/agent-rules.md`.
Evidence tags: [V] verified, [C] claim from a third-party source, [D] derived, [A] assumption.

## 1. System shape

```
browser ──> projecthouse.uz (one origin)
              ├── /api/*  ──> FastAPI backend (Python)  ──> PostgreSQL 17
              └── /*      ──> Next.js frontend (server-rendered pages)
```

- **One origin.** The browser only talks to one host. `/api/*` goes to FastAPI, everything else to
  Next.js. Dev: a Next.js rewrite of `/api/:path*` to `API_URL`. Production: the reverse proxy
  (Step 0b). Reason: the session cookie works without cross-origin rules, and the later WebSocket
  DMs authenticate with the same cookie. The Next.js proxy matcher already excludes `/api` [V].
- Server components in Next.js call the backend directly at `API_URL` (internal network), forwarding
  the user's cookie when needed.
- No other services in Phase 1 (no Redis, no queue). Added only when a measured need appears.

## 2. Backend structure

```
backend/app/
  main.py              create_app(): middleware, routers, lifespan
  core/                shared plumbing, no business rules
    config.py          Settings (env), APP_ENV
    db.py              engine, session dependency, lifespan dispose, Base
    errors.py          AppError + handler -> one JSON error shape
    pagination.py      keyset cursor encode/decode
  users/               user profile basics (owned by the foundation)
  auth/                login, sessions, OAuth, email tokens (Task B)
  projects/            projects, media, demo seed, feed API (Task A)
  health/              GET /api/health (existing)
```

Each feature package has the same files, created only when needed:

| File | Owns | Must not |
|---|---|---|
| `models.py` | SQLAlchemy tables of this feature | import another feature's service |
| `schemas.py` | Pydantic request/response models (the API contract) | contain DB queries |
| `service.py` | business rules and queries (async functions taking an `AsyncSession`) | know about HTTP (no Request/Response) |
| `router.py` | HTTP only: parse input, call service, return schema | contain business rules or raw SQL |

- Features talk to each other through the other feature's `service.py` functions, never its models
  directly. (Exception: SQLAlchemy relationships/foreign keys across tables.)
- **No generic repository or unit-of-work layer.** SQLAlchemy's `AsyncSession` already is one; an
  extra layer would be an abstraction without a concrete problem.
- One concrete abstraction is allowed because a real swap exists: `EmailSender` (console in dev,
  provider in production).

## 3. Configuration

`app/core/config.py`, pydantic-settings, all from environment:

| Setting | Dev default | Production |
|---|---|---|
| `APP_ENV` | `development` | `production` (also `test`) |
| `DATABASE_URL` | `postgresql+asyncpg://projecthouse:projecthouse_dev@127.0.0.1:55432/projecthouse` | **required, no default** (startup fails without it) |
| `SECRET_KEY` | fixed dev string | **required**, 32+ random bytes |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | not needed (one origin) |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | `https://projecthouse.uz` |
| OAuth client ids/secrets | empty (provider disabled) | required for enabled providers |

This closes Step 0's Ruling B: the dev default can never silently reach production.

## 4. Database

- PostgreSQL 17, SQLAlchemy 2 async + asyncpg, **Alembic** for every schema change (async env).
- Primary keys: `bigint` identity. Public URLs use usernames and slugs, never ids.
- Timestamps: `timestamptz`, stored UTC, `created_at` / `updated_at` on every table.
- Naming convention for constraints set on `Base.metadata` (pk/fk/uq/ck/ix names are deterministic,
  so migrations stay readable).
- Small fixed lists (account type, project field, media kind) are `text` + validation in code and a
  `CHECK` constraint, **not** Postgres enums (enums are painful to alter).
- Engine: `pool_pre_ping=True`; disposed in the FastAPI lifespan on shutdown.

### Tables and owners

| Table | Owner | Key columns and rules |
|---|---|---|
| `users` | foundation | `username` unique, lowercase, `^[a-z0-9_-]{3,30}$` (no dots, D17), not in the reserved list; `display_name`; `account_type` developer\|company; `headline`, `location`, `university_or_employer`, `company_name` (company accounts), `open_to_work` bool, `is_verified_company` bool, `avatar_url`, `links` jsonb |
| `auth_identities` | Task B | `user_id` FK; `provider` google\|github\|email; `provider_user_id`; `email`; `email_verified`; unique (`provider`, `provider_user_id`); unique (`user_id`, `provider`): one identity per provider per user |
| `password_credentials` | Task B | `user_id` PK/FK; `password_hash` (argon2 via pwdlib) |
| `sessions` | Task B | `user_id` FK; `token_hash` unique (SHA-256 of the cookie token); `expires_at`; `last_seen_at`; `user_agent` |
| `email_tokens` | Task B | `user_id` FK; `purpose` verify\|reset; `token_hash`; `expires_at`; `used_at` |
| `projects` | Task A | `owner_id` FK nullable; `is_demo` bool; `demo_author`, `demo_author_url`; `slug`; `title`; `one_line_problem`; `short_description`; `result`; `field`; `tech_stack text[]` (GIN index); `github_url`; `live_url` (nullable, CHECK `http(s)://` only); `demo_video_url`; `license`; `role`; `published_at` |
| `project_media` | Task A | `project_id` FK on delete cascade; `kind` image\|video; `url`; `position`; `alt` |

Integrity rules on `projects`:
- `CHECK (owner_id IS NOT NULL OR is_demo)`: only demo rows may have no owner.
- Unique `(owner_id, slug)` for real projects; unique `slug` among demo rows.
- Feed index on `(published_at DESC, id DESC)`. `published_at` is NOT NULL (default `now()`): the
  keyset cursor cannot order NULLs, so a NULL row would silently drop out of the feed.
- `project_media.project_id` is indexed: the feed loads media with `WHERE project_id IN (...)` and
  the cascade delete looks rows up by it.
- `owner_id` has no ON DELETE action yet (deleting a user with projects is blocked). Decided
  (Bek, 2026-11-17): deleting an account deletes its projects, so the account-deletion task adds a
  migration changing this FK to ON DELETE CASCADE. (`SET NULL` is impossible under the CHECK above.)

Reserved usernames (code constant, extended as routes appear): `uz ru en api _next _vercel demo
new messages settings login logout signup admin explore feed search about help forgot-password reset-password verify-email onboarding`.

## 5. API conventions

- Prefix **`/api/v1`** for all feature routes (`/api/health` stays as is).
- JSON only, snake_case fields, timestamps ISO 8601 UTC.
- One error shape for every 4xx/5xx raised by our code:
  `{"error": {"code": "project_not_found", "message": "Project not found"}}`.
- **Keyset pagination** for lists: `?limit=24&cursor=<opaque>`; response
  `{"items": [...], "next_cursor": "..." | null}`. Cursor = base64 of (`published_at`, `id`).
  Never offset pagination (new projects shift pages).
- Validation errors from FastAPI keep status 422 but are mapped to the same error shape.

## 6. Authentication (Task B)

- **Server-side sessions.** Login creates a random 32-byte token; the cookie `ph_session` carries
  the token (HttpOnly, Secure in production, SameSite=Lax, Path=/, 30 days); the DB stores only its
  SHA-256 hash. Logout deletes the row. Not JWT: sessions must be revocable and simple.
- **CSRF:** SameSite=Lax plus an Origin/Referer check on every state-changing request
  (POST/PUT/PATCH/DELETE) against `PUBLIC_BASE_URL`.
- **Passwords:** pwdlib with argon2. Minimum 10 characters. Never logged.
- **OAuth (Google, GitHub):** Authlib's Starlette client. It needs Starlette `SessionMiddleware`
  (signed with `SECRET_KEY`) for the OAuth `state`; that cookie is separate from `ph_session`.
- **Account linking (Bek, 2026-11-17, after security review H1; refined by reviews N1-N3):** a
  provider identity is linked only while the user is logged in ("log in first, then connect"),
  never by email match alone. Reason: automatic linking on a verified email allows pre-account
  hijack (an attacker signs up with the victim's email, the victim clicks the unsolicited verify
  link, the victim's first Google login lands in the attacker's account).
  OAuth callback, logged in as U (connect flow, checked first):
  identity already U's -> no change; identity owned by another user -> no change,
  `/settings?error=provider_in_use&provider=<p>`; U already has that provider ->
  `/settings?error=provider_already_connected&provider=<p>`; U's email identity is unverified ->
  `/settings?error=verify_email_first&provider=<p>` (otherwise an attacker could attach their own
  provider account to an address they squatted); else the identity is connected to U.
  OAuth callback, logged out: known (provider, provider_user_id) logs in; else, if any identity has
  the same normalized email, nothing is created and the browser goes to
  `/login?error=account_exists&provider=<p>` (the owner logs in, or resets the password, then
  connects); else a new developer account is created.
  A provider email is stored only when the provider reports it verified (Google `email_verified`,
  GitHub verified primary email); otherwise it is NULL, so an unverified address can never block
  its real owner.
  A password reset proves ownership of the email: it marks the email identity verified, revokes all
  sessions and other reset tokens, and, if the email was unverified before, deletes every
  non-email identity attached to the account before that proof.
- **`GET /api/v1/auth/providers`** (public) returns `{"providers": [...]}`: only the providers whose
  client id AND secret are both set, in the order `google`, `github`. The login page shows buttons from
  this list, so it never offers a provider whose start route would answer 404.
- **Email verification and password reset:** single-use tokens, hashed in `email_tokens`, expiry
  24 h (verify) / 1 h (reset). Sent through `EmailSender`; dev implementation prints to the console.
- **Verification needs the account's session (Bek, 2026-11-17, security review N1b):** a verify
  token is accepted only from a request carrying a valid `ph_session` of the token's user. No
  session -> 401 `not_authenticated` (the frontend sends the user to log in and back); a session of
  another user -> 400 `token_invalid`; in both cases the token stays unused. Reason: clicking a
  link proves mailbox ownership, not that the clicker created the account. Without this, a victim
  who clicks an unsolicited verify link verifies an attacker's account, which can then carry the
  attacker's provider identities past a password reset.
- fastapi-users is not used: its PyPI page states "This project is now in maintenance mode" [V,
  pypi.org/project/fastapi-users, latest 15.0.5, 2026-03-27].
- Rate limiting of login attempts: deferred to Step 0b (reverse proxy level); noted, not built.

## 7. Demo data (Task A)

- Demo projects are `projects` rows with `is_demo = true`, `owner_id = NULL`, the original author
  in `demo_author` / `demo_author_url`. No user accounts are created for them (Bek, option 1).
- Public URL: `/demo/<slug>` (never `/<username>/...`, so a future real user with the same name as a
  demo author cannot collide). `demo` is a reserved username.
- Loader: `python -m app.projects.seed_demo` (idempotent upsert by slug) and `--delete` (removes
  every demo row). Refuses to run when `APP_ENV=production`.
- Images and videos are linked from their GitHub/YouTube URLs, not copied.

## 8. Testing

- Backend tests run against a real PostgreSQL. Each test session migrates a dedicated test database
  with `alembic upgrade head`; every test starts from empty tables (truncate after each test).
- Test engine uses `NullPool` (no pooled connection survives an event loop).
- Parallel work: each agent uses its own database name in `DATABASE_URL`
  (`projecthouse_test_<task>`) on the shared Postgres container, so test runs do not collide.
- CI adds a migration job: exactly one Alembic head, and `upgrade head` succeeds on an empty DB.

## 9. Frontend (Task C, later)

- Next.js App Router, server components fetch from `API_URL`; client components only for
  interaction. Tokens from `docs/design/tokens.css`, Inter via `next/font`.
- `localePrefix: 'never'` (D17); interface language from cookie / browser.
- Pages follow `docs/design/design-guide.md` and the mockups.
