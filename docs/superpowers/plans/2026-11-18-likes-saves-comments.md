# Likes, Saves, Comments, Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **This plan:** Bek chose execution: the orchestrator builds it himself, one task at a time, screenshots against the design, advisor gate per page, one Opus review of the branch at the end.

**Goal:** Logged-in people like, save, comment on and report projects; each person sees their own Saved and Liked lists from their profile.

**Architecture:** A new `app/social` package owns four tables (migration 0006) and the `/me` write routes; read paths add `like_count` (cards, detail), `liked`/`saved` (detail, for the viewer) and `like_total` (profile). The project page loads with the visitor's cookie. Frontend adds the action row, comments, a report dialog, and the `/saved` and `/liked` pages.

**Tech Stack:** FastAPI, async SQLAlchemy, Alembic, pytest; Next.js 16.4.6, next-intl, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-18-likes-saves-comments-design.md`

## Global Constraints

- Projects are named by their numeric `id` (added to card and detail responses).
- Like and save: `PUT` / `DELETE /api/v1/me/likes/{project_id}` and `/me/saves/{project_id}`, idempotent (204).
- Comments: body 1-1000 after trimming, no NUL; oldest first; delete by the author or the project's owner; ownerless samples: author only.
- Reports: reason in `spam | not_own_work | offensive | other`; note 0-500; snapshot up to 1000; one per person per item (repeat answers 200, no new row); survive deletion of the item (SET NULL) and of the reporter (SET NULL).
- Lists `/me/saved`, `/me/liked`: newest saved/liked first, cursor `(created_at, project_id)`, page 24, card shape.
- `saved` and `liked` are reserved usernames.
- All writes need login and the Origin check; no email confirmation; developers and companies alike.
- uz / ru / en with the modifier letters; no emoji; desktop 1440 matches the drawing closely, tablet second, phone 360/390 "does not break".

## Review Focus

1. Liking twice, or unliking something never liked, leaves the count right and answers 204. Test in Task 1.
2. Someone else's Saved or Liked list can never be read (no route takes a user name). Test in Task 1.
3. Deleting a reported project or comment keeps the report with its snapshot. Test in Task 2.
4. Deleting a project removes its likes, saves and comments (counts on other pages stay right). Test in Task 1.
5. A logged-out visitor pressing the heart is sent to login and comes back to the same project. Test in Task 3 (browser).

---

### Task 1: Likes, saves, counts and the lists (backend)

**Files:**
- Create: `backend/app/social/{__init__,models,service,router}.py`, migration `backend/alembic/versions/2026_11_18_0006_social_add_likes_saves_comments_reports.py`, `backend/tests/test_social_likes.py`
- Modify: `backend/app/core/models_registry.py`, `backend/app/main.py`, `backend/app/projects/schemas.py` (`id`, `like_count` on cards and detail; `liked`, `saved` on detail), `backend/app/projects/service.py` (counts for a page of cards in one query), `backend/app/projects/router.py` (detail routes take `current_user_optional`), `backend/app/users/router.py` + `schemas.py` (`like_total`), `backend/app/users/usernames.py` + `docs/architecture.md` reserved list (`saved`, `liked`)

**Interfaces:**
- Produces: models `ProjectLike`, `ProjectSave`, `Comment`, `Report`; `like_counts(session, project_ids) -> dict[int, int]`; `viewer_state(session, user_id, project_id) -> tuple[bool, bool]`; routes above; `GET /api/v1/me/saved|liked?limit&cursor -> FeedPage`.

- [ ] **Step 1: Failing tests** (`auth_client`):
  - `test_like_and_unlike_are_idempotent` (Review Focus 1): PUT twice -> count 1; DELETE twice -> 0; DELETE never-liked -> 204.
  - `test_like_unknown_project_is_404`; `test_like_requires_login` (401) and Origin (403).
  - `test_detail_shows_count_and_viewer_state`: other user's like -> `like_count` 1, `liked` false for me; after my like -> true; logged out -> `liked`/`saved` false.
  - `test_cards_carry_like_counts` (feed and a profile list).
  - `test_saved_and_liked_lists_are_mine_only_and_newest_first` (Review Focus 2): two users; each list has only the caller's; order by save time not publish time; cursor pages.
  - `test_profile_like_total`.
  - `test_deleting_a_project_removes_its_likes_and_saves` (Review Focus 4).
  - `test_saved_and_liked_are_reserved_usernames`.
- [ ] **Step 2-4:** run (FAIL), implement, backend gate (pytest, ruff check, ruff format --check) -> pass.
- [ ] **Step 5: Commit** `feat(backend): likes, saves and your Saved and Liked lists`

### Task 2: Comments and reports (backend)

**Files:**
- Modify: `backend/app/social/{service,router}.py`, `schemas`
- Test: create `backend/tests/test_social_comments_reports.py`

**Interfaces:**
- Produces: `GET /api/v1/projects/{project_id}/comments?cursor` -> `{items: [{id, body, created_at, author: {name, url, avatar_url}, can_delete}], next_cursor}` (`can_delete` for the viewer); `POST /api/v1/projects/{project_id}/comments` `{body}` -> 201 comment; `DELETE /api/v1/me/comments/{id}` -> 204; `POST /api/v1/me/reports` `{project_id | comment_id, reason, note}` -> 201 new / 200 repeat. Detail gains `comment_count`.
- Error codes: `invalid_comment` (422), `comment_not_found` (404), `invalid_report` (422).

- [ ] **Step 1: Failing tests:** body rules (blank, 1001, NUL -> `invalid_comment`; trimmed); oldest first and cursor; author deletes own; project owner deletes another's; a third user -> 404; sample (ownerless) only the author; `can_delete` right for author/owner/stranger/logged out; report a project and a comment; repeat -> 200 and one row; bad reason or both/neither targets -> `invalid_report`; note 501 -> `invalid_report`; deleting the reported project or comment keeps the report with `target_kind`, snapshot and null target (Review Focus 3); deleting the reporter keeps the report (reporter null).
- [ ] **Step 2-4:** run (FAIL), implement, backend gate -> pass.
- [ ] **Step 5: Commit** `feat(backend): comments and reports`

### Task 3: Project page: heart, Saqlash, comments, report (frontend)

**Files:**
- Create: drawing screen 2b in `docs/design/2026-11-17-screens-mockup.html` (action row with heart + count and Saqlash, Shikoyat qilish in the links row, comment section with delete, report dialog; desktop/tablet/phone), `frontend/src/components/social/{LikeButton,SaveButton,Comments,ReportDialog}.tsx`, `frontend/src/lib/social-errors.ts`
- Modify: `frontend/src/lib/projects.ts` (send the visitor's cookie), `frontend/src/lib/types.ts`, `ProjectView.tsx`, `ProjectCard.tsx` (like count in the meta row), `frontend/src/lib/client-api.ts` (`clientPut`), messages
- Test: `frontend/tests/social-errors.test.ts`

- [ ] **Step 1: Draw** screen 2b; capture (UTF-8 check, no "Ê", modifier letters).
- [ ] **Step 2: Failing test rows** for the new codes -> fields/form; messages in uz/ru/en.
- [ ] **Step 3: Implement.** Heart and Saqlash update at once and roll back on failure; logged out -> `/login?next=<this page>`; comment box with counter; delete asks once; report dialog (native `<dialog>`, opens on Cancel).
- [ ] **Step 4: Run** lint, test, build (`API_URL=http://localhost:8002` for runtime checks).
- [ ] **Step 5: Visual gate:** 1440/768/390/360 against 2b; flows: like/unlike, save, comment, delete own, owner deletes another's, report project and comment, logged-out heart -> login -> back (Review Focus 5); `MATCH.md`; advisor compares.
- [ ] **Step 6: Commit** `feat(frontend): like, save, comment and report on the project page`

### Task 4: Saqlanganlar and Yoqtirganlarim (frontend)

**Files:**
- Create: drawing (profile buttons + list pages) in the mockup, `frontend/src/app/[locale]/saved/page.tsx`, `frontend/src/app/[locale]/liked/page.tsx` (login required; same grid and load-more as the profile; empty state)
- Modify: `frontend/src/components/profile/ProfileCard.tsx` (two buttons, owner only), `frontend/src/components/projects/LoadMore.tsx` if the endpoint needs no change, messages, profile stats show `like_total`

- [ ] **Step 1: Draw**, capture.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** lint, test, build.
- [ ] **Step 4: Visual gate:** own profile shows the buttons, another's does not; lists show the right projects newest first; empty states; logged out -> login; 1440/390/360; `MATCH.md`; advisor compares.
- [ ] **Step 5: Commit** `feat(frontend): your Saved and Liked lists`

### After the tasks (orchestrator)

Full gates; one Opus branch review (privacy of the lists, report rules, counts); fixes and re-check; push, PR, CI; merge is Bek's.
