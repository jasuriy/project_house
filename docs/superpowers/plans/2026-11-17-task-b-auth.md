# Task B: Login (email, Google, GitHub) and sessions

Branch: `task-b-auth` (own worktree, from the reviewed `foundation` head).
Read first: `docs/architecture.md` (sections 2, 3, 4, 5, 6, 8), `docs/agent-rules.md`.
Test database: `projecthouse_test_auth` on 127.0.0.1:55432. Do not start or stop containers.
Runs in parallel with Task A; you own only `app/auth/`, its migration and its tests. Shared files:
one import line in `app/core/models_registry.py`; in `app/main.py` one router line plus the two
middleware registrations (SessionMiddleware, Origin check). New settings go into
`app/core/config.py` only as listed below.

## Goal

Backend login for both account types: email + password, Google, GitHub; server-side sessions;
email verification and password reset; a `current_user` dependency other features can use.
No frontend pages in this task.

## Deliverables

1. **Dependencies** (pin exact, latest stable at install): `authlib`, `pwdlib[argon2]`,
   `itsdangerous` (required by Starlette SessionMiddleware). Report versions.
2. **Settings** added to `core/config.py`: `google_client_id`, `google_client_secret`,
   `github_client_id`, `github_client_secret` (empty default = provider disabled, its routes return
   404 `provider_disabled`), `session_days: int = 30`.
3. **Models + migration**: `auth_identities`, `password_credentials`, `sessions`, `email_tokens`
   exactly as architecture section 4: revision id `0002_auth` (exactly this; never `0002`),
   `down_revision = "0001"`. If Task A merges first, the orchestrator re-points `down_revision` to
   `0002_projects` at merge time; do not anticipate it.
4. **Session mechanics** (`sessions.py` or `service.py`): token = `secrets.token_urlsafe(32)`;
   DB stores SHA-256 hex; cookie `ph_session` HttpOnly, SameSite=Lax, Path=/, Secure when
   `app_env == "production"`, Max-Age = `session_days`. Expired sessions rejected and deleted.
   `last_seen_at` updated at most once per hour per session.
5. **Dependencies for other features** (`app/auth/dependencies.py`): `current_user_optional` and
   `current_user` (401 `not_authenticated`).
6. **Origin check middleware** (`app/auth/csrf.py`): for POST/PUT/PATCH/DELETE under `/api/`,
   reject with 403 `bad_origin` unless `Origin` (or, if absent, `Referer`) matches
   `public_base_url`. Requests with neither header are rejected too. OAuth callbacks are GET and
   unaffected.
7. **Routes** (prefix `/api/v1/auth`):
   - `POST /signup` `{email, password, username, display_name, account_type}` -> 201, user +
     email identity (unverified) + password + session cookie; verification email sent.
     Username rules from `app.users.usernames.validate_username`; duplicate email or username ->
     409 `email_taken` / `username_taken`.
   - `POST /login` `{email, password}` -> 200 + cookie; any failure -> 401
     `invalid_credentials` (same message whether the email exists or not).
   - `POST /logout` -> 204, session row deleted, cookie cleared.
   - `GET /me` -> current user (`UserPublic` plus `email`, `email_verified`, `providers`) or 401.
   - `POST /email/verify` `{token}` -> 204; single use; expired -> 400 `token_invalid`.
   - `POST /password/forgot` `{email}` -> 202 always (no account enumeration); sends reset email
     only if the account exists.
   - `POST /password/reset` `{token, new_password}` -> 204; deletes all sessions of that user.
   - `GET /oauth/{provider}/start` -> redirect to the provider (Authlib Starlette client).
   - `GET /oauth/{provider}/callback` -> find identity by (provider, provider_user_id): log in;
     else if the provider reports a **verified** email equal to an existing user's verified
     email: link and log in; else create a new developer account (username generated from the
     provider login / email local part, sanitized to the username rules, numeric suffix on clash).
     Redirect to `public_base_url` (new accounts: `public_base_url + "/onboarding"`).
8. **Passwords**: pwdlib argon2; minimum 10 characters (422 `weak_password` otherwise).
9. **EmailSender** (`app/auth/email.py`): `Protocol` with `send(to: str, subject: str, body: str)`;
   `ConsoleEmailSender` logs subject and recipient and the link (dev/test only). Injected via a
   FastAPI dependency so tests can capture messages.

## Tests that must exist (write first)

- Signup sets `ph_session` with HttpOnly and SameSite=Lax; DB holds a hash, not the cookie value.
- Login: correct password 200; wrong password and unknown email both 401 with identical body.
- `/me` 401 without cookie, 200 with; expired session 401 and row removed; logout makes the old
  cookie useless.
- Origin check: POST with foreign Origin 403 `bad_origin`; with correct Origin passes; with no
  Origin and no Referer 403.
- Verify token: works once, second use 400; expired 400.
- Reset: unknown email still 202 and no email captured; known email captures one message; reset
  token changes the password and removes all existing sessions.
- OAuth (Authlib token/userinfo exchange mocked): new identity creates a user and session;
  verified matching email links to the existing account; **unverified** matching email creates a
  separate account (no link); username collision gets a suffix; disabled provider 404.
- Passwords and tokens never appear in any response body (assert on all auth responses in tests).

## Out of scope

Frontend sign-in pages, onboarding UI, "Connect GitHub" for repo ownership (Step 2), rate
limiting (Step 0b), real email provider (Step 0b). Do not touch `app/projects/` or `app/users/`
models (use `app.users` service functions; if you need a new one, report NEEDS_CONTEXT).
