# Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **This plan:** Bek chose execution: the orchestrator builds it himself, one task at a time, screenshots against the design, advisor gate per page, one Opus review of the branch at the end.

**Goal:** `/<username>` shows who a person is and all their projects as a grid; the owner can edit their profile; the 29 samples belong to Bek's account.

**Architecture:** Backend adds `users.about`, a profile response with `project_count`, a per-user projects list that reuses the feed query, and `PATCH /api/v1/auth/me` with hand-written per-field checks. Sample ownership moves into the loader (`--owner`); author and path follow ownership. Frontend adds `/[username]` (server component, Task C variant G pattern) and `/settings/profile` (client form, same-origin PATCH).

**Tech Stack:** FastAPI, async SQLAlchemy, Alembic, pytest; Next.js 16.4.6, next-intl, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-18-profile-page-design.md`

## Global Constraints

- Error shape stays `{"error":{"code","message"}}`; no new fields in it.
- Email, phone, Telegram never appear on a profile.
- Field rules (spec table): `display_name` trimmed 1-60 not blank; `headline` 0-120; `location` 0-80; `university_or_employer` 0-120 (developer); `company_name` 0-80 (company); `open_to_work` bool (developer); `about` 0-1000; `links.github` empty or `https://github.com/<name>` (developer); `links.linkedin` empty or `https://linkedin.com/...` / `https://www.linkedin.com/...` (developer); `links.website` empty or `https://` URL max 200 (both). Empty string clears.
- Not editable: `username`, `account_type`, `is_verified_company`, `avatar_url`.
- No photo upload, no Message button, no like count, no `--delete` option.
- Texts in uz / ru / en; no emoji anywhere.
- Desktop 1440 must match the mockup closely; tablet second; phone only "does not break".
- Test-size rule (Task C plan): one row per input class, no markup tests.
- No new dependencies.

## Review Focus

1. Whitespace-only text (`"   "`) in `headline` is stored as NULL; in `display_name` it is `invalid_display_name`. Test in Task 2.
2. A company account sending `open_to_work`, `university_or_employer`, `links.github` or `links.linkedin` gets 422 `field_not_allowed` and nothing is saved. Test in Task 2.
3. `javascript:` or `http://` links are refused by the API, and the profile page renders links only through `safeExternalUrl`. Tests in Task 2 (API) and Task 4 (link helper).
4. A user with 0 projects gets `project_count: 0` and the empty state; an unknown username gets the 404 page, not the error box. Tests in Task 1 (API) and Task 4 (curl status).
5. Running the loader without `--owner` after an owned run keeps the owner. Test in Task 3.

---

### Task 1: Profile data API

**Files:**
- Create: `backend/alembic/versions/2026_11_18_0004_users_about_add_users_about.py` (`users.about text NULL`, down drops it)
- Modify: `backend/app/users/models.py` (`about`), `backend/app/users/schemas.py`, `backend/app/users/router.py`, `backend/app/projects/service.py`, `backend/app/projects/router.py`
- Test: `backend/tests/test_users.py`, `backend/tests/test_projects_api.py`, `backend/tests/test_migrations.py` (if it pins the head revision)

**Interfaces:**
- Produces: `UserPublic.about: str | None`; `class ProfileResponse(UserPublic): project_count: int`; `GET /api/v1/users/{username}` returns `ProfileResponse`; `list_feed(session, *, field, limit, cursor, owner_id: int | None = None) -> FeedPage`; `GET /api/v1/users/{username}/projects?limit&cursor -> FeedPage` (same limit bounds as the feed), 404 `user_not_found`.

- [ ] **Step 1: Write the failing tests**
  - `test_profile_returns_about_and_project_count`: user with `about="Hi"` and 2 owned projects (+1 demo ownerless) -> 200, `about == "Hi"`, `project_count == 2`, no `email` key.
  - `test_profile_of_user_without_projects_has_count_zero` -> `project_count == 0`.
  - `test_user_projects_lists_only_that_users_projects_newest_first`: users A (3 projects) and B (1) -> A's list has 3 paths all starting `/a/`, ordered by `published_at` desc.
  - `test_user_projects_pages_with_cursor`: 3 projects, `limit=2` -> 2 items + `next_cursor`; second call -> 1 item, `next_cursor is None`.
  - `test_user_projects_unknown_user_is_404` -> 404, code `user_not_found`.
- [ ] **Step 2: Run** `cd backend && .venv/Scripts/python -m pytest tests/test_users.py tests/test_projects_api.py -q` -> new tests FAIL.
- [ ] **Step 3: Implement** the migration, model column, schemas, `owner_id` filter in `list_feed`, the count (one `select(func.count())` in `users/service.py`: `count_projects(session, user_id) -> int`), and both routes. The projects route lives in `projects/router.py` beside `/users/{username}/projects/{slug}`.
- [ ] **Step 4: Run** the backend gate: `.venv/Scripts/python -m pytest -q` and `.venv/Scripts/ruff check .` -> all pass, ruff clean.
- [ ] **Step 5: Commit** `feat(backend): profile about, project count and a user's projects list`

### Task 2: Edit own profile (`PATCH /api/v1/auth/me`)

**Files:**
- Modify: `backend/app/users/schemas.py` (`ProfileUpdate`, `LinksUpdate`), `backend/app/users/service.py` (`update_profile`), `backend/app/auth/router.py` (route)
- Test: create `backend/tests/test_profile_edit.py`

**Interfaces:**
- Consumes: `current_user` (`app/auth/dependencies.py:29`), `_account()` (`app/auth/router.py:61`).
- Produces: `PATCH /api/v1/auth/me` body = any subset of the Global Constraints fields; `links` is a partial object `{github?, linkedin?, website?}` (absent key = unchanged, `""` = removed). Returns `AccountResponse` (now with `about`). Error codes (422): `invalid_display_name`, `invalid_headline`, `invalid_location`, `invalid_university_or_employer`, `invalid_company_name`, `invalid_about`, `invalid_github_link`, `invalid_linkedin_link`, `invalid_website_link`, `field_not_allowed`. Unknown keys: pydantic `extra="forbid"` (existing `validation_error`).
- `update_profile(session, user: User, changes: ProfileUpdate) -> User`: checks fields in table order and raises the first failing code; writes nothing on any failure.

- [ ] **Step 1: Write the failing tests** (`auth_client` logged in; one row per class):
  - `test_patch_updates_given_fields_only`: send `{"headline":"CV student"}` -> 200, headline set, `location` unchanged.
  - `test_patch_trims_and_clears`: `{"headline":"   "}` -> headline `None`; `{"location":"  Tashkent "}` -> `"Tashkent"`.
  - `test_patch_rejects_blank_display_name` (`"  "`) -> 422 `invalid_display_name`.
  - `test_patch_length_limits` parametrized: headline 121, location 81, university_or_employer 121, about 1001, display_name 61 -> matching `invalid_*`; one row exactly at a limit (headline 120) -> 200.
  - `test_patch_links` parametrized: github `https://github.com/aziz` ok; github `http://github.com/aziz`, `https://gitlab.com/aziz`, `javascript:alert(1)` -> `invalid_github_link`; linkedin `https://www.linkedin.com/in/aziz` ok, `https://linkedin.evil.com/x` -> `invalid_linkedin_link`; website `https://aziz.dev` ok, `http://aziz.dev` and a 201-char https URL -> `invalid_website_link`.
  - `test_patch_empty_link_removes_key`: set github, then `{"links":{"github":""}}` -> `"github" not in links`, other keys kept.
  - `test_company_cannot_set_developer_fields` parametrized over `open_to_work`, `university_or_employer`, `links.github`, `links.linkedin` -> 422 `field_not_allowed`, profile unchanged. Mirror: developer sending `company_name` -> `field_not_allowed`.
  - `test_patch_cannot_change_username_or_type`: `{"username":"x"}` -> 422 `validation_error`.
  - `test_patch_requires_login` (plain `client`) -> 401; `test_patch_without_origin_is_403` (existing CSRF pattern in `test_auth_csrf.py`).
  - `test_first_failure_writes_nothing`: `{"headline":"ok","about":"x"*1001}` -> 422 and headline unchanged.
- [ ] **Step 2: Run** `.venv/Scripts/python -m pytest tests/test_profile_edit.py -q` -> FAIL.
- [ ] **Step 3: Implement.** Link checks parse with `urllib.parse.urlsplit`: scheme `https`, exact host (`github.com`; `linkedin.com` or `www.linkedin.com`), github path one non-empty segment.
- [ ] **Step 4: Run** the backend gate (pytest + ruff) -> pass.
- [ ] **Step 5: Commit** `feat(backend): edit your own profile`

### Task 3: Samples belong to an account

**Files:**
- Modify: `backend/app/projects/seed_demo.py`, `backend/app/projects/schemas.py` (`_path`, `_author`), `backend/app/projects/service.py` (`get_demo_project`), `docs/architecture.md` section 7
- Test: `backend/tests/test_projects_seed.py`, `backend/tests/test_projects_api.py`

**Interfaces:**
- Produces: CLI `python -m app.projects.seed_demo [--file PATH] [--owner USERNAME]`; `upsert_demo(session, entries, owner_id: int | None = None) -> int`. `--delete` and `delete_demo` are removed.
- Rule: a row with `owner_id` -> `Author(kind="user", ...)`, path `/<username>/<slug>`; ownerless rows keep the demo author and `/demo/<slug>`. `get_demo_project` adds `Project.owner_id.is_(None)`.

- [ ] **Step 1: Write / change the tests**
  - Delete `test_delete_demo_removes_demo_rows_and_media_but_keeps_real_projects`; change `test_cli_loads_the_real_seed_twice_then_deletes` to load twice only.
  - `test_upsert_with_owner_sets_owner_on_every_sample`: 29 rows, all `owner_id == user.id`, `is_demo` true.
  - `test_upsert_without_owner_keeps_an_existing_owner` (Review Focus 5).
  - `test_cli_owner_unknown_username_exits_2_and_writes_nothing`.
  - `test_cli_rejects_delete_flag`: `main(["--delete"])` raises `SystemExit` with code 2 (argparse).
  - API: `test_owned_sample_card_shows_the_owner`: card `author == {"kind":"user","name":<display_name>,"url":"/<username>"}`, path `/<username>/<slug>`; `GET /api/v1/users/<username>/projects/<slug>` -> 200; `GET /api/v1/projects/demo/<slug>` -> 404.
- [ ] **Step 2: Run** `.venv/Scripts/python -m pytest tests/test_projects_seed.py tests/test_projects_api.py -q` -> new tests FAIL.
- [ ] **Step 3: Implement.** The owner is wiped by the update branch, not the insert: `project_values()` sets `owner_id: None` and the upsert copies it onto existing rows, so without `--owner` leave `owner_id` out of the values applied to existing rows (check the Review Focus 5 test fails on today's code first). Update `docs/architecture.md` section 7: samples may be owned by an account (Bek, 2026-11-18, development data, deleted by Bek with the delete button from step 2); loader `--owner`; no `--delete`.
- [ ] **Step 4: Run** the backend gate -> pass.
- [ ] **Step 5: Commit** `feat(backend): samples can be owned by an account; drop --delete`

### Task 4: Profile page `/[username]`

**Files:**
- Create: `frontend/src/app/[locale]/[username]/page.tsx`, `frontend/src/components/profile/ProfileCard.tsx`, `frontend/src/components/profile/ProfileTabs.tsx` (client: Projects / About), `frontend/src/lib/profile.ts` (`getProfile = cache(username)`, `getUserProjects = cache(username)`, `profileLinks(links) -> {key, label, href}[]`)
- Modify: `frontend/src/lib/types.ts` (`Profile = UserPublic + about + project_count`; `Account.about`), `frontend/src/components/projects/LoadMore.tsx` (props become `{ initialCursor, endpoint: string, params?: Record<string,string> }`; feed passes `/api/v1/projects` + field), `frontend/src/app/[locale]/page.tsx`, `frontend/src/components/projects/ProjectView.tsx:121,143` (`project.author.kind === "demo"` instead of `is_demo`), `frontend/src/components/SiteHeader.tsx:30` (name becomes a link to `/<username>`), `frontend/messages/{uz,ru,en}/` (new `Profile` namespace in `projects.json`)
- Test: `frontend/tests/profile-links.test.ts`

**Interfaces:**
- Consumes: Task 1 routes; `ProjectCard`, `ShareButton({label, copiedLabel})`, `safeExternalUrl`.
- `profileLinks` keeps only keys `github`, `linkedin`, `website`, drops values `safeExternalUrl` rejects; label for github is the path name (`github.com/aziz` -> `aziz`), for linkedin "LinkedIn", for website the host.

- [ ] **Step 1: Write the failing test** `profile-links.test.ts`, one row per class (plus `isUsername(name)`: `aziz` true, `robots.txt` false): github URL -> label `aziz`; linkedin -> `LinkedIn`; website `https://aziz.dev/x` -> `aziz.dev`; `javascript:alert(1)` -> dropped; unknown key `telegram` -> dropped; non-string value -> dropped.
- [ ] **Step 2: Run** `cd frontend && npm test -- profile-links` -> FAIL.
- [ ] **Step 3: Implement** the page per mockup 3 (developer: side card + tabs + 3-column grid) and 3b (company: side card without a stats row + About panel, then projects if any), header card on tablet/phone, initials avatar (first letters of up to two words of `display_name`), Share always, "Edit profile" (link to `/settings/profile`) when the viewer is the owner (`getCurrentUser()?.username === username`), privacy line for developers, empty state, `notFound()` without an API call when the name fails `^[a-z0-9_-]{3,30}$` (`isUsername` in `profile.ts`; `/robots.txt` and probes hit this route), the name encoded into the API path as `projects.ts` does, `notFound()` on 404, long names wrap (`break-words`, signup has no name cap), tab title `Name (@username) - Project House`. Grid page size 24 like the feed.
- [ ] **Step 4: Run** `npm run lint`, `npm test`, `npm run build` -> clean / pass / compiled.
- [ ] **Step 5: Visual gate** (backend with the demo seed loaded with `--owner` for a test account): screenshots 1440, 768, 390 of a developer profile with projects, a company profile, an empty profile, saved in `docs/design/screenshots/profile/` next to mockup captures; `MATCH.md` lists known differences (Share alone where the mockup pairs it with Message); advisor compares; `curl -I` existing profile 200, unknown 404.
- [ ] **Step 6: Commit** `feat(frontend): the profile page, matched to the mockup`

### Task 5: Edit-profile form `/settings/profile`

**Files:**
- Create: drawing screen in `docs/design/2026-11-18-auth-mockup.html` (new screen 10, developer and company variants, desktop and phone, approved design system), `frontend/src/app/[locale]/settings/profile/page.tsx` (server: `getCurrentUser()`, redirect to `/login?next=/settings/profile` when logged out), `frontend/src/components/profile/ProfileForm.tsx` (client), `frontend/src/lib/profile-errors.ts` (`profileErrorField(code) -> field | "form"`)
- Modify: `frontend/src/lib/client-api.ts` (`clientPatch<T>(path, body)`, same contract as `clientPost`), `frontend/src/app/[locale]/settings/page.tsx` (link "Edit profile"), messages (`ProfileForm` and `ProfileErrors` namespaces in `auth.json`)
- Test: `frontend/tests/profile-errors.test.ts`

**Interfaces:**
- Consumes: Task 2 contract and codes; `TextField` (`requiredMark`, `help`, `error`, `maxLength` passthrough), `Banner`.
- Sends only changed fields; `maxLength` on each input equals the Global Constraints limit; `about` is a textarea with a character counter; `open_to_work` a checkbox (developer only); save button disabled while pending (one request per click).

- [ ] **Step 1: Write the failing test** `profile-errors.test.ts`: each of the 10 codes -> its field (`field_not_allowed` and unknown codes -> `"form"`), `constructor` -> `"form"`; every code has a message in uz/ru/en.
- [ ] **Step 2: Run** `npm test -- profile-errors` -> FAIL.
- [ ] **Step 3: Draw** screen 10, screenshot it into `docs/design/screenshots/profile-edit/design-*.png`.
- [ ] **Step 4: Implement** the page, form, `clientPatch`, settings link; on success show the ok banner and `router.refresh()`.
- [ ] **Step 5: Run** lint, test, build -> clean / pass / compiled.
- [ ] **Step 6: Visual gate**: `ours-*` at 1440 and 390 (developer, company, a field error) vs the drawing, `MATCH.md`, advisor compares. Flow check in the browser: edit headline, save, profile page shows it; double click sends one request; logged out -> login redirect.
- [ ] **Step 7: Commit** `feat(frontend): edit your profile`

### After the tasks (orchestrator)

- Full gates (backend pytest + ruff, frontend lint + test + build).
- One Opus review of the branch (spec, quality, overengineering, security of PATCH and links); fix, re-check.
- Push, PR, CI; merge is Bek's.
- Bek signs up locally with his chosen username; run `python -m app.projects.seed_demo --owner <username>` on the dev database.
