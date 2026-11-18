# Deploy for friends' testing - Design

Date: 2026-11-18. Status: for Bek's approval (builder check done, Bek's answers folded in).

## Intent

Put Project House online so Bek can share one link with friends, who try it and send feedback and bug
reports. It is a private beta, not a public launch: a few dozen people, invited by Bek. Every other
feature waits until this is live (Bek, 2026-11-18).

## Goals

- One public address (a `*.vercel.app` name) where friends sign in with GitHub and can:
  - browse the feed and open projects;
  - like, save, comment and report;
  - add their own projects with images, and import from GitHub;
  - edit their profile.
- The feed starts with Bek's 29 sample projects on his own account `jasurai` (Bek), deleted later
  with the delete button.
- A footer link where friends report bugs and give feedback.
- Redeploying after a change is one command per side, written down, so the next features ship the
  same way.
- Data survives redeploys and restarts: the database is restorable, and images live in object storage.

## Non-goals

- Email sign-up, email login, verification and password reset (Bek: "github only for now, email
  later"). The code stays; it is switched off in production.
- Google login, a custom domain, Telegram previews, messages, the admin screen.
- Per-person limits and an invite list (Bek: open sign-up, no limits for now).
- High availability, autoscaling beyond one warm container, load testing.

## Anti-goals (a failure even if it "works")

- A friend's private state leaking to another friend through any cache: their liked/saved state,
  their own lists, their delete buttons.
- Secrets in the repository, in chat, in logs or in the browser bundle.
- Losing uploaded images or accounts on a redeploy.
- Bek's local site and dev database changing because of the deployment.

## Decided by Bek

- Frontend on Vercel; backend on Modal; the database not on Modal.
- GitHub login only for now.
- Start with the 29 samples on `jasurai`, loaded with a one-time override flag on the seed tool. The
  production guard stays on by default.
- Images go to R2 at deploy (decided earlier: "disk now, R2 at deploy").
- Backups: Neon's built-in restore, plus a full `pg_dump` before every migration that is deployed.
- Sign-up open to anyone with the link, no per-person limits for now ("we won't have this kind of
  issue").
- Feedback and bug reports go to GitHub issues. The repository is public with issues on
  [V: `gh repo view jasuriy/project_house` -> PUBLIC issues=true].

## Approaches

| | A: Vercel + Modal + Neon + R2 (chosen) | B: Vercel + Railway (backend + Postgres) + R2 | C: like A, images on a Modal Volume |
|---|---|---|---|
| Fit | Bek's choice of Modal; Modal's GPUs help the later AI features | Fewer accounts, always on, Postgres next to the backend | One account fewer (no Cloudflare) |
| Cost | Neon, R2, Vercel free tiers; Modal pays per second for one warm container | Small monthly fee | as A |
| Risk | One more hop (Modal to Neon); both pinned to the EU | Not what Bek chose | Modal docs: Volume writes show in other containers only after commit and reload; last write wins. Wrong for user uploads |

A, because Bek chose Modal and R2 was already decided; B is the fallback if Modal turns out wrong.

## Architecture

```
browser --> https://<name>.vercel.app  (Vercel, Next.js, function region fra1)
              |  pages: server-side rendered; server code calls API_URL directly with the visitor's cookie
              |  /api/*: forwarded by the Next rewrite to API_URL (same origin for the browser)
              v
           https://<workspace>--<app>-<function>.modal.run  (Modal, FastAPI, region ["eu"], 1 warm container)
              |-- Postgres: Neon, AWS eu-central-1 (Frankfurt)
              |-- images: private Cloudflare R2 bucket, read and written by the backend only
              |-- GitHub: OAuth (login) and REST (import, ownership check) with a server token
```

The browser only ever talks to the Vercel address, so the session cookie stays first-party and the
backend's Origin check keeps working (PUBLIC_BASE_URL = the Vercel address).

## Changes

### Backend

1. **Modal entry point** `backend/modal_app.py`.
   - Image built from `requirements.txt`, adding `app/`, `alembic/`, `alembic.ini` and
     `seed/demo-projects.json` (the seed tool reads it from the repository root
     [V: `seed_demo.py:33`]).
   - `web`: `@app.function(region=["eu"], min_containers=1, secrets=[modal.Secret.from_name(...)])`
     and `@modal.asgi_app()` returning the existing FastAPI app. Memory is enough for argon2's 64 MiB
     per hash times the concurrent requests allowed.
   - `migrate`: runs `alembic upgrade head` against the production database.
   - `seed_samples`: runs `seed_demo --owner jasurai --allow-production`.
   - Deploy is `modal deploy backend/modal_app.py`. Migrate is
     `modal run backend/modal_app.py::migrate`.
2. **Seed override.**
   - The seed tool refuses `APP_ENV=production` before touching anything
     [V: `seed_demo.py:142-144`, docs/architecture.md].
   - A new `--allow-production` flag lifts that refusal only together with `--owner`. Without the
     flag, nothing changes.
   - architecture.md records the exception.
3. **R2 image storage.** `app/media/storage.py` gets a second backend chosen by a setting
   (`MEDIA_BACKEND=disk|r2`, default `disk`). R2 is used through its S3-compatible API, and keys are
   unchanged.
   - **No blocking.** The storage functions become async and run their R2 calls in a worker thread,
     so a slow R2 call never stalls other requests. This touches their callers (`media/service.py`,
     `media/router.py`, `projects/editing.py`), not only `storage.py`. The builder check found that
     today `save` and `delete` run directly on the event loop [V: 7 call sites]. Claude's call.
   - **Serving images.** Images keep their `/api/v1/media/<key>` address. That route reads from R2
     and answers `Cache-Control: public, max-age=31536000, immutable`, since keys never change, so
     Vercel's CDN caches each image and R2 is read about once per image. Claude's call.
   - **Why not the bucket's own address:** Cloudflare says the `r2.dev` public address "is
     rate-limited and should only be used for development" [V: Cloudflare R2 public buckets docs].
     The bucket stays private.
   - New settings: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
   - Disk stays the default, so local development and the tests do not change.
4. **Email login switch.** A setting `EMAIL_LOGIN_ENABLED` (default true; false in production).
   - When false, the email routes answer 404 `email_login_disabled`: signup, login, forgot, reset,
     verify and resend.
   - The GitHub flows are unchanged.
   - Production cannot send email anyway: the sender fails closed by design.
5. **No caching of API answers.** A middleware sets `Cache-Control: private, no-store` on `/api/*`
   responses, except `/api/v1/media/*` (above).
   - This is required: Vercel's proxy caches upstream answers whenever their headers allow it, which
     is the default for new projects [V: Vercel rewrites docs].
   - It closes the review's DEFERRED item for viewer-dependent GETs.
6. **Production settings.** All are set in the Modal secret; none are in the repository.
   - `APP_ENV=production`
   - `SECRET_KEY`: at least 32 characters, generated by Bek.
   - `DATABASE_URL`: Neon, with TLS.
   - `PUBLIC_BASE_URL` and `CORS_ORIGINS`: the Vercel address.
   - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`: a new OAuth app for the Vercel callback URL.
   - `GITHUB_API_TOKEN`: required here. Without it every GitHub call shares 60 calls per hour per
     outbound IP, and cloud IPs are shared [A: Modal egress IPs are shared between customers].
   - The R2 settings, `MEDIA_BACKEND=r2` and `EMAIL_LOGIN_ENABLED=false`.
7. **Database driver.** Use Neon's direct (not pooled) endpoint. With one container and SQLAlchemy's
   pool this is enough, and it avoids asyncpg's prepared-statement problems behind a transaction pooler.

### Frontend

1. **Vercel project** with `frontend/` as its root.
   - `API_URL` = the Modal URL, set as a build variable. The rewrite and the server-side fetches
     already read it [V: `next.config.ts`, `src/lib/api.ts:17`].
   - Function region `fra1`, near Modal EU and Neon Frankfurt.
2. **GitHub-only sign-in.** A build flag `NEXT_PUBLIC_EMAIL_LOGIN=false` hides the email parts:
   - login and signup show only the GitHub button;
   - forgot-password, reset-password and verify-email lead to the login page;
   - Settings hides the email and password sections.
   - Locally the flag is unset, so nothing changes.
3. **Images.** Card and page images are plain `<img>` tags pointing at `/api/v1/media/...` already
   [V: `CoverImage.tsx:27-28`], so nothing changes.
4. **Feedback link.** The site footer gets "Fikr va xatolar" (uz/ru/en), linking to the repository's
   new-issue page.

### Data

- Run migrations on the empty Neon database (0001 to 0006).
- Before every later migration, take a `pg_dump` of the production database and keep it outside
  the repository.
- Bek signs in on the live site with GitHub once and picks the username `jasurai` in onboarding.
- Then `seed_samples` gives the 29 samples to that account. The sample images are external URLs,
  so nothing is uploaded.

## Bek's steps (guided, one at a time)

Secrets are typed by Bek into the providers' own pages or CLIs, never into chat.

1. Create free accounts on Vercel, Modal, Neon and Cloudflare (R2 needs a card on file
   [A: Cloudflare asks for a payment method to enable R2; free tier 10 GB]).
2. Neon: create a project in the Frankfurt region and copy the connection string into the Modal
   secret. Check the free plan's restore window [U: the cheapest check is the plan page at sign-up].
3. Cloudflare: create a private bucket and an API token limited to it.
4. GitHub:
   - a new OAuth app with the callback `https://<name>.vercel.app/api/v1/auth/oauth/github/callback`
     [V: `backend/app/auth/router.py:187`, `:193`; the URL is built from PUBLIC_BASE_URL];
   - a fine-grained personal token with no extra permissions, used as `GITHUB_API_TOKEN`.
5. Log in on the CLIs: `modal token new` and `vercel login`. Then the deploy commands (Claude runs them).

## Verification on the live site (before the link is shared)

- Sign in with GitHub as Bek: onboarding, username `jasurai`, then seed the samples.
- With a second GitHub account:
  - like, save, comment and report;
  - check that /saved and /liked show each person only their own list;
  - check that liked/saved state does not leak between the two browsers (cache test).
- Add a project by hand with images. Upload a 4.9 MB image [U: whether Vercel's proxy caps request
  bodies at 4.5 MB, the Functions limit; if it does, lower the upload limit to 4 MB, front and back,
  in the same change]. Import from GitHub, edit, delete.
- Check that the Origin check passes through Vercel [U: Vercel's docs do not say whether `Origin` is
  forwarded; if it is not, compare against `x-forwarded-host` from Vercel instead].
- Check that images load a second time from Vercel's cache (`x-vercel-cache: HIT`) and that
  `/api/v1/me/saved` is never cached.
- Redeploy the backend and check that the data and images are still there.
- The footer link opens the new-issue page.

## Costs [A: verify each at sign-up; numbers change]

- Vercel Hobby: free, for non-commercial use (a friends' beta qualifies).
- Neon: free tier.
- R2: free up to 10 GB, no egress fees.
- Modal: per-second billing for one small always-warm CPU container in `eu` (1.15x price multiplier
  [V: Modal region docs]).
- Bek sees the Modal estimate before `min_containers=1` goes live. The fallback is
  `min_containers=0`, with a few seconds' cold start.

## Left to the builder

- Exact Modal container memory and concurrency.
- How the S3 client is created and reused.
- The middleware's placement.
- Names of the Modal app, functions and secret.
- The redeploy section of the README.
- Vercel Git integration versus CLI deploys.

## Builder check (2026-11-18)

A fresh reviewer read this design against the code. Its questions and their outcomes:

1. **The seed tool refuses production.** Bek chose the one-time `--allow-production` flag.
2. **Storage calls block the event loop.** Claude's call: async storage functions.
3. **Backups.** Bek chose Neon restore plus a dump before each migration.
4. **Open sign-up.** Bek chose open, with no limits for now.
5. **`r2.dev` is for development only.** Images are now served through `/api/v1/media` with a long
   cache header.
