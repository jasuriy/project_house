# Task D: optional live site link on projects

Branch: `task-d-live-url` (worktree `.claude/worktrees/task-d`, from main c8ef59a).
Read first: `docs/architecture.md` (sections 4, 5, 7), `docs/agent-rules.md`, spec section 8.
Test database: `projecthouse_test_live` on 127.0.0.1:55432. Do not start or stop containers.
Decision: Bek, 2026-11-17 ("yes" to a live site link). Owner: `app/projects/` only.

## Goal

A project may link to where it can be opened and used (a website or web app), next to its GitHub
and demo video links. Optional; most ML and hardware projects leave it empty.

## Deliverables

1. Column `projects.live_url` (`text`, NULL allowed) with
   `CHECK (live_url IS NULL OR live_url ~* '^https?://')`, named by the naming convention. Reason:
   the frontend renders it as a link; a `javascript:` URL would run code in a visitor's browser.
2. Migration revision id `0003_project_live_url`, `down_revision = "0002_auth"`; downgrade drops
   the constraint and the column.
3. `ProjectDetail` gains `live_url: str | None`. `ProjectCard` does not change.
4. Demo loader: `live_url` = the seed entry's `link`, except when it equals `repo_url` (compare with
   trailing `/` removed), then NULL. Today that is 2 entries (GSY GitHub App, VHS), so 27 of 29 demo
   projects get a live link.

## Tests that must exist (write first)

- The DB rejects `live_url = 'javascript:alert(1)'` and accepts NULL, `http://...`, `https://...`.
- `GET /api/v1/projects/demo/{slug}` returns `live_url` (a value for a demo with a link, null for VHS).
- Loading the real seed gives exactly 27 demo projects with a non-null `live_url`; re-loading stays 27.
- Migration up/down/up works (existing migration test) and `alembic check` is clean.

## Out of scope

Any create/edit API, frontend, other fields. No new settings, no new dependencies.
