# Task A: Projects, demo data and feed API

Branch: `task-a-projects` (own worktree, from the reviewed `foundation` head).
Read first: `docs/architecture.md` (sections 2, 4, 5, 7, 8), `docs/agent-rules.md`, `seed/README.md`.
Test database: `projecthouse_test_projects` on 127.0.0.1:55432. Do not start or stop containers.
Runs in parallel with Task B; you own only `app/projects/`, its migration, its tests, and the
`seed/` folder. Shared files: one import line in `app/core/models_registry.py`, one router line in
`app/main.py`.

## Goal

Store the 29 demo projects in PostgreSQL and serve the feed and project pages through the API.

## Deliverables

1. **Models** `Project`, `ProjectMedia` exactly as architecture section 4, including
   `CHECK (owner_id IS NOT NULL OR is_demo)`, the two partial unique indexes (owner+slug for real,
   slug for demo), the GIN index on `tech_stack`, the feed index `(published_at DESC, id DESC)`,
   `CHECK` on `field` and on media `kind`.
2. **Field list** `FIELDS = ("ai-apps", "cv-ml", "web", "mobile", "devtools", "hardware", "data")`
   in `app/projects/fields.py` (display names are the frontend's job).
3. **Migration** adding both tables (down_revision = the foundation head).
4. **Service** (`service.py`):
   - `list_feed(session, *, field: str | None, limit: int, cursor: str | None) -> FeedPage`
     newest first by `(published_at, id)`, keyset via `core.pagination`; `limit` 1..60, default 24.
   - `get_demo_project(session, slug) -> Project` (404 `project_not_found`).
   - `get_user_project(session, username, slug) -> Project` (404 when user or project missing).
5. **Schemas** (`schemas.py`):
   - `ProjectCard`: `slug`, `path` (`/demo/<slug>` or `/<username>/<slug>`), `title`,
     `one_line_problem`, `field`, `tech_stack` (max 3), `cover` (`{kind, url}` of the first media
     or null), `author` (`{kind: "demo"|"user", name, url}`), `published_at`.
   - `ProjectDetail`: every project field, full `tech_stack`, ordered `media`, `author`, `path`.
   - `FeedPage`: `{items: list[ProjectCard], next_cursor: str | None}`.
6. **Routes** (`router.py`, prefix `/api/v1`):
   - `GET /projects?field=&limit=&cursor=` -> `FeedPage` (unknown `field` -> 422).
   - `GET /projects/demo/{slug}` -> `ProjectDetail`.
   - `GET /users/{username}/projects/{slug}` -> `ProjectDetail`.
7. **Demo loader** `python -m app.projects.seed_demo [--file PATH] [--delete]`:
   - default file `<repo>/seed/demo-projects.json`; refuses with exit code 2 and a clear message when
     `APP_ENV=production`;
   - idempotent upsert by demo slug (slug = lowercase title, non `[a-z0-9]` runs -> `-`, trimmed);
   - `published_at` = the entry's `pushed_at` (UTC midnight);
   - media: each `image_urls` entry -> image rows in order; `demo_video_url` -> position 0, kind
     `video` for youtube.com / youtu.be / loom.com / vimeo.com / `.mp4`, kind `image` for `.gif`;
   - `--delete` removes all `is_demo` rows (media cascade).
8. **Seed fix**: rewrite the `evcc` entry's `short_description` in your own words (an earlier check
   found 7 of 23 six-word runs copied from its README). Touch no other entry.

## Tests that must exist (write first)

- Feed: newest first; `field` filter; `limit` respected; following `next_cursor` returns the next
  page with no duplicates or gaps across 3 pages; last page `next_cursor` null; bad cursor 400.
- Detail: demo slug 200 with media ordered; unknown slug 404 error shape; user project route 404
  when the user does not exist.
- Integrity: inserting a project with `owner_id NULL` and `is_demo false` fails; duplicate demo
  slug fails; bad `field` fails.
- Loader: loading the real `seed/demo-projects.json` twice leaves exactly 29 demo projects;
  `--delete` leaves 0; `APP_ENV=production` refuses (exit code 2, nothing written).
- Card: `tech_stack` capped at 3; `author.kind == "demo"` with the original author for demo rows.

## Out of scope

Creating, editing or deleting projects through the API; likes, saves, comments; GitHub import;
frontend pages; auth. Do not touch `app/auth/` or `app/users/`.
