# Add Project (part 2: GitHub import) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **This plan:** Bek chose execution: the orchestrator builds it himself, one task at a time, screenshots against the design, advisor gate per page, one Opus review of the branch at the end.

**Goal:** Paste a GitHub link and the add form fills itself; every GitHub link on a project must belong to the user's connected GitHub account.

**Architecture:** A small injectable GitHub client (`app/projects/github.py`) reads three public REST endpoints. One ownership function is used by the import endpoint (preview only) and by create/edit whenever the GitHub link changes. The OAuth "connected" outcome returns to Settings. Frontend `/new` gains step 1 and passes the pre-fill into the existing `ProjectForm`.

**Tech Stack:** FastAPI, httpx (existing), pytest; Next.js 16.4.6, next-intl, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-18-add-project-github-design.md`

## Global Constraints

- Ownership: connected GitHub account required (`github_not_connected`); owner = `owner.id` equals the linked `provider_user_id` and the repo is not a fork; contributor = linked id in the first 100 contributors; else `not_your_repo`; private/missing = `github_repo_not_found`; down, slow (10 s timeout), rate-limited = `github_unavailable` (503).
- GitHub responses: follow 301; contributors 204 = empty; contributors 403 "too large" = owner rule only.
- Never store or use the user's GitHub OAuth token. Optional `GITHUB_API_TOKEN` setting sent as bearer when set.
- Import pre-fill: title = repo name; short_description = repo description; tech_stack = up to 5 languages by size; live_url = homepage if http(s); github_url = canonical `html_url`; license = SPDX name or null; relation; github_login.
- A save re-checks when the canonical sent `github_url` differs from the stored one; clearing the link clears the licence.
- No new dependencies; tests never call the network.
- uz / ru / en texts with the modifier letters; no emoji; desktop 1440 matches the drawing closely, tablet second, phone "does not break" (360/390).

## Review Focus

1. A fork the user only copied (owner matches, no commits) is refused with `not_your_repo`. Test in Task 1.
2. GitHub rate-limited (403 with `x-ratelimit-remaining: 0`) gives `github_unavailable`, not `not_your_repo` or a 500. Test in Task 1.
3. Typing someone else's repo link into the manual form and saving is refused on the `github_url` field. Test in Task 2.
4. Saving an edit without touching the GitHub link makes no GitHub call. Test in Task 2.
5. A link with a trailing slash, `www.`, or different letter case matches the stored canonical link (no needless re-check). Test in Task 2.

---

### Task 1: GitHub client, ownership check, import endpoint

**Files:**
- Create: `backend/app/projects/github.py`, `backend/tests/github_fake.py` (a fake client with canned repos), `backend/tests/test_github_import.py`
- Modify: `backend/app/core/config.py` (`github_api_token: str = ""`), `backend/app/projects/router.py`, `backend/app/projects/schemas.py` (`ImportRequest`, `ImportPreview`)

**Interfaces:**
- Produces: `class GitHubClient` with `async repo(owner, name) -> RepoInfo`, `async languages(owner, name) -> dict[str, int]`, `async contributor_ids(owner, name) -> set[int] | None` (None = list unavailable, "too large"); `get_github() -> GitHubClient` (FastAPI dependency); `parse_github_url(url: str) -> tuple[str, str] | None`; `async check_ownership(session, user, github, url) -> Ownership(repo: RepoInfo, relation: Literal["owner","contributor"], login: str)`; `POST /api/v1/me/projects/import` -> `ImportPreview`.
- `RepoInfo`: `id, owner_id, owner_login, name, html_url, fork, description, homepage, license_spdx` (from `license.spdx_id`, `None` when absent or `NOASSERTION`).

- [ ] **Step 1: Failing tests** (fake client via dependency override; GitHub identity added with the existing auth fixtures/service):
  - `test_import_own_repo_prefills`: owner match -> 200 with title, description, top-5 languages by size, homepage, canonical url, licence, `relation == "owner"`.
  - `test_import_contributor_repo`: owner differs, id in contributors -> `relation == "contributor"`.
  - `test_import_someone_elses_repo_is_refused` -> 422 `not_your_repo`.
  - `test_import_copied_fork_is_refused` (Review Focus 1): fork, owner matches, not in contributors -> `not_your_repo`; fork with own commits -> `contributor`.
  - `test_import_without_github_connected` -> 422 `github_not_connected`.
  - `test_import_missing_or_private_repo` -> 422 `github_repo_not_found`.
  - `test_import_github_down_or_rate_limited` (Review Focus 2): fake raising the client's unavailable error -> 503 `github_unavailable`.
  - `test_import_too_large_contributors_uses_owner_rule`: `contributor_ids` None -> owner passes, non-owner `not_your_repo`.
  - `test_import_bad_link` -> 422 `invalid_github_url`; `test_import_company_403`.
  - Client unit tests with `httpx.MockTransport` (no network): 301 followed, contributors 204 -> empty set, 403 rate-limit -> unavailable, 403 too-large -> None, 404 -> not found, timeout -> unavailable, bearer header sent only when the token is set.
- [ ] **Step 2: Run** `pytest tests/test_github_import.py -q` -> FAIL.
- [ ] **Step 3: Implement.** `parse_github_url` reuses part 1's GitHub link rule (`editing._github`); one shared `httpx.AsyncClient` per client instance with `follow_redirects=True`, `timeout=10`, `User-Agent: ProjectHouse`, `Accept: application/vnd.github+json`.
- [ ] **Step 4: Run** the backend gate (`pytest -q`, `ruff check .`, `ruff format --check .`) -> pass.
- [ ] **Step 5: Commit** `feat(backend): GitHub import with the ownership check`

### Task 2: Check on save, licence, "connected" back to Settings

**Files:**
- Modify: `backend/app/projects/editing.py` (create/update take the GitHub client), `backend/app/projects/router.py`, `backend/app/auth/router.py` (connected -> `/settings?connected=<provider>`)
- Test: `backend/tests/test_projects_editing.py`, `backend/tests/test_auth_oauth.py`

**Interfaces:**
- Consumes: Task 1 `check_ownership`, `get_github`, `parse_github_url`.
- Create/update: when the canonical `github_url` differs from the stored one and is non-empty, run `check_ownership`, store `repo.html_url` and `license = repo.license_spdx`; empty clears both. Errors on the `github_url` field with Task 1's codes.

- [ ] **Step 1: Failing tests:**
  - `test_create_with_someone_elses_github_link_is_refused` (Review Focus 3) -> 422 `not_your_repo`, nothing created.
  - `test_create_with_own_link_stores_canonical_link_and_licence`.
  - `test_edit_without_touching_the_link_calls_github_zero_times` (Review Focus 4): fake counts calls.
  - `test_same_link_written_differently_is_not_rechecked` (Review Focus 5): trailing slash / `www.` / case.
  - `test_clearing_the_link_clears_the_licence`.
  - Part 1 tests that set `github_url` use a fake that owns those repos (update their setup, not their assertions).
  - OAuth: `test_connect_returns_to_settings_with_connected` -> 302 to `/settings?connected=github`.
- [ ] **Step 2-4:** run (FAIL), implement, backend gate -> pass.
- [ ] **Step 5: Commit** `feat(backend): every GitHub link is checked on save; connect returns to Settings`

### Task 3: `/new` step 1 and the pre-filled form

**Files:**
- Create: drawing of step 1 in `docs/design/2026-11-17-screens-mockup.html` (screen 4a: link field, Continue, "without GitHub" link; the not-connected box), `frontend/src/components/editor/GitHubStep.tsx`
- Modify: `frontend/src/app/[locale]/new/page.tsx` (step 1 first; `?manual=1` or the link skips to the form), `frontend/src/components/editor/ProjectForm.tsx` (optional `prefill: ImportPreview`, the green banner, "GitHub'dan" badges on filled fields, read-only licence row next to the GitHub field), `frontend/src/app/[locale]/settings/page.tsx` (green banner on `?connected=`), `frontend/src/lib/project-errors.ts` (+ `github_not_connected`, `not_your_repo`, `github_repo_not_found`, `github_unavailable` -> `github_url`), `frontend/src/lib/types.ts` (`ImportPreview`), messages
- Test: `frontend/tests/project-errors.test.ts` (new rows)

- [ ] **Step 1: Draw** screen 4a; capture `design-*.png` (check `document.characterSet` is UTF-8 and no "Ê").
- [ ] **Step 2: Failing test rows** for the four new codes -> `github_url`, messages present in uz/ru/en; run -> FAIL.
- [ ] **Step 3: Implement**; the not-connected box links to `/settings`; the edit page shows the licence row too.
- [ ] **Step 4: Run** lint, test, build (with `API_URL=http://localhost:8002` for runtime checks) -> clean / pass / compiled.
- [ ] **Step 5: Visual gate**: on the test site, give a test account the GitHub identity of GitHub's public demo account (`octocat`; insert its `auth_identities` row with its numeric id) and import `https://github.com/octocat/Hello-World` through the real GitHub API (a few calls, within the 60/hour limit). Screenshots 1440 / 768 / 390 / 360 of step 1, the not-connected box (another test account) and the pre-filled form, against the drawing; `MATCH.md`; advisor compares.
- [ ] **Step 6: Commit** `feat(frontend): GitHub import step on the add page`

### After the tasks (orchestrator)

Full gates; one Opus branch review (ownership rule and error handling first); fixes and re-check; push, PR, CI; merge is Bek's. Then Bek tries the real import on his local site with his connected GitHub.
