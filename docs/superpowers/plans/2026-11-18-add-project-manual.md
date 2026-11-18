# Add Project (part 1: manual) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **This plan:** Bek chose execution: the orchestrator builds it himself, one task at a time, screenshots against the design, advisor gate per page, one Opus review of the branch at the end.

**Goal:** A developer adds, edits and deletes their own project (fields, video link, up to 6 uploaded images) and can upload a profile photo.

**Architecture:** Images are uploaded one at a time to `/api/v1/me/uploads` (Pillow re-encodes to WebP, stored on disk through `app/media/storage.py`, served at `/api/v1/media/<key>`). Project create/edit sends upload ids and kept media ids to `/api/v1/me/projects`. URLs are built from storage keys at response time. Frontend pages `/new` and `/<username>/<slug>/edit` share one client form.

**Tech Stack:** FastAPI, async SQLAlchemy, Alembic, Pillow, pytest; Next.js 16.4.6, next-intl, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-18-add-project-manual-design.md`

## Global Constraints

- Developers only (403 `developers_only`); samples are Delete-only (403 `sample_read_only`).
- Field rules: title 1-80; one_line_problem 1-160; short_description 1-1000; result 0-160; field in the fixed list; tech_stack 1-12 tags each 1-30, duplicates removed; github_url empty or `https://github.com/<owner>/<repo>`; live_url empty or http(s) max 200; role 0-120; video_url empty or a YouTube/Loom link; images 0-6; video or at least one image.
- Images: JPEG/PNG/WebP, max 5 MB enforced while streaming (413 `image_too_large`), longest side 1600 px, WebP without metadata; avatar 512 px square crop; at most 12 unused uploads per user (429 `too_many_uploads`); unused uploads older than 24 h are deleted on every upload (anyone's, small batch).
- Media route: key `^[0-9a-f]{32}\.webp$`, `Content-Type: image/webp`, `X-Content-Type-Options: nosniff`.
- One error code per field, existing `{"error":{code,message}}` shape; any failure writes nothing.
- Slug from title, `[a-z0-9-]`, unique per owner (`-2`, `-3`), no Latin letters -> `project`; never changes on edit.
- New backend dependency: `Pillow` only (uploads are raw bodies, no multipart). No new frontend dependencies.
- Media URLs are absolute: `{public_base_url}/api/v1/media/<key>` (works with `safeExternalUrl`, matches R2 and og:image later).
- Runtime checks never touch Bek's local site (3000/8000, database `projecthouse`): backend on 8002, frontend built with `API_URL=http://localhost:8002` and served on 3002, database `projecthouse_test_c2`; stop only 3002/8002.
- uz / ru / en texts; no emoji; desktop 1440 matches the design closely, tablet second, phone "does not break".
- Test-size rule: one row per input class, no markup tests.

## Review Focus

1. Another user's upload id or another project's media id in a request -> 422 `invalid_images`, nothing attached or deleted. Test in Task 2.
2. A non-image file renamed `.png`, a 0-byte file and a 5 MB + 1 byte file are refused; a decompression bomb (huge dimensions, tiny file) is refused. Test in Task 1.
3. Removing an image on edit deletes its file; deleting a project deletes its files but never touches sample URLs. Test in Task 2.
4. Editing a project leaves its slug and URL unchanged even when the title changes. Test in Task 2.
5. `/bob-name/foo/edit` opened by someone else shows 404, not their own project's form. Test in Task 4 (curl with a session).

---

### Task 1: Storage, uploads, media route

**Files:**
- Create: `backend/app/media/__init__.py`, `backend/app/media/storage.py`, `backend/app/media/images.py`, `backend/app/media/models.py` (`Upload`), `backend/app/media/router.py`, `backend/alembic/versions/2026_11_18_0005_uploads_add_uploads_and_keys.py` (table `uploads`; `project_media.storage_key text NULL`; `users.avatar_key text NULL`)
- Modify: `backend/requirements.txt` (Pillow pinned), `backend/app/core/config.py` (`media_root: str = "media"`), `backend/app/main.py` (router), `.gitignore` (`backend/media/`), `backend/app/projects/models.py` + `backend/app/users/models.py` (new columns)
- Test: create `backend/tests/test_media.py`

**Interfaces:**
- Produces: `storage.save(data: bytes) -> str` (key `<32 hex>.webp`), `storage.url(key: str) -> str` (`/api/v1/media/<key>`), `storage.delete(key: str) -> None`; `images.to_webp(data: bytes, *, max_side: int = 1600, square: int | None = None) -> bytes` raising `AppError(422, "invalid_image")`; `POST /api/v1/me/uploads` (raw body = the image bytes, `Content-Type` image/jpeg|png|webp) -> `{"id": str, "url": str}`; `GET /api/v1/media/{key}`; `consume_uploads(session, owner_id: int, ids: list[str]) -> list[str]` (keys, one `DELETE ... RETURNING`, raises 422 `invalid_images` if any id is missing).

- [ ] **Step 1: Write the failing tests** (`auth_client` pattern from `test_profile_edit.py`; images made with Pillow in the test):
  - `test_upload_png_returns_id_and_webp_url`: 200, `url` ends `.webp`, GET of the url -> 200 `image/webp`, `nosniff`.
  - `test_upload_strips_metadata_and_resizes`: 3000x1000 JPEG with EXIF -> stored image 1600x533, no EXIF.
  - `test_upload_rejects` parametrized: text body sent as image/png, 0 bytes, GIF -> 422 `invalid_image`; 5 MB + 1 byte raw body, with and without `Content-Length` (chunked) -> 413 `image_too_large`; 20000x20000 PNG and one between 1x and 2x the pixel limit -> 422 `invalid_image`.
  - An autouse fixture points `media_root` at `tmp_path` (tests never write into the repo).
  - `test_upload_requires_login` -> 401; `test_upload_company_is_403` -> `developers_only`.
  - `test_thirteenth_unused_upload_is_429`.
  - `test_old_unused_uploads_of_anyone_are_cleaned`: upload by user A with `created_at` moved 25 h back; upload by user B -> A's row and file are gone.
  - `test_media_route_rejects_bad_keys` parametrized: `../x.webp`, `abc.png`, `x` -> 404.
  - `test_consume_uploads_only_own_and_once`: other user's id -> 422 `invalid_images`; consuming twice -> second 422.
- [ ] **Step 2: Run** `pytest tests/test_media.py -q` -> FAIL.
- [ ] **Step 3: Implement.** Reject early when `Content-Length` > 5 MB; read `request.stream()` with a byte counter and stop at 5 MB + 1 (413). `Image.open` reads only the header: check `width * height <= 40_000_000` before `load()`/`exif_transpose` (Pillow only warns between 1x and 2x its own limit); accept formats JPEG/PNG/WEBP only; `ImageOps.exif_transpose` then `thumbnail`; save WebP quality 82 without exif. Default `media_root` resolved from the module path (not the working directory). Cleanup order: `DELETE ... RETURNING key`, commit, then delete files.
- [ ] **Step 4: Run** the backend gate: `pytest -q`, `ruff check .`, `ruff format --check .` -> pass.
- [ ] **Step 5: Commit** `feat(backend): image uploads, disk storage and the media route`

### Task 2: Own projects API

**Files:**
- Create: `backend/app/projects/editing.py` (rules + create/update/delete), `backend/app/projects/slugs.py` (move `slugify` here from `seed_demo.py`, re-export there)
- Modify: `backend/app/projects/schemas.py` (`ProjectInput`, `ProjectUpdate`, `EditableProject`; media URL from key; cover rule), `backend/app/projects/router.py` (four `/me/projects` routes), `backend/app/projects/service.py` (if helpers belong there)
- Test: create `backend/tests/test_projects_editing.py`

**Interfaces:**
- Consumes: Task 1 `consume_uploads`, `storage.url/delete`.
- Produces: `POST /api/v1/me/projects` (201, `ProjectDetail`); `GET /api/v1/me/projects/{slug}` -> `EditableProject` (fields + `video_url` + `images: [{id: int, url: str}]`); `PATCH /api/v1/me/projects/{slug}` (any subset; `images` replaces the image list: items `{"upload": str}` or `{"media": int}`); `DELETE /api/v1/me/projects/{slug}` (204). Error codes: `invalid_title`, `invalid_one_line_problem`, `invalid_short_description`, `invalid_result`, `invalid_field`, `invalid_tech_stack`, `invalid_github_url`, `invalid_live_url`, `invalid_role`, `invalid_video_url`, `invalid_images`, `media_required` (422); `developers_only`, `sample_read_only` (403); `project_not_found` (404).
- Cover rule (`ProjectCard.from_project`): first media item that is an image or a YouTube video, else the first media item (so an mp4/Loom-only sample keeps its play-mark cover); media `url` = `storage.url(storage_key)` when a key is set.
- Two creates racing for the same slug: catch the unique-index error and retry the next suffix once, else 409 `slug_taken`.

- [ ] **Step 1: Write the failing tests** (one row per class):
  - `test_create_minimal_with_video` -> 201, path `/<username>/<slug>`, `demo_video_url` set, media[0] kind video; card appears on the feed and the profile.
  - `test_create_with_images_orders_them`: two uploads -> media in the given order after the video.
  - `test_create_field_rules` parametrized over each field's over-limit or bad value -> its code; `tech_stack` `[]` and 13 tags -> `invalid_tech_stack`; duplicates removed.
  - `test_create_requires_video_or_image` -> 422 `media_required`.
  - `test_slug_rules`: same title twice -> `-2`; title `Проект` -> `project`.
  - `test_ids_must_be_yours` (Review Focus 1): another user's upload id, another project's media id -> 422 `invalid_images`, the other project unchanged.
  - `test_patch_keeps_slug_when_title_changes` (Review Focus 4).
  - `test_patch_removes_image_and_its_file` (Review Focus 3).
  - `test_delete_removes_project_and_files_but_not_sample_urls`: own project with an upload -> file gone; delete an owned sample -> 204, no storage call for its URLs.
  - `test_sample_patch_is_403_sample_read_only`; `test_company_create_is_403`; `test_other_users_slug_is_404`; `test_requires_login_and_origin` (401, 403 `bad_origin`).
  - `test_loom_video_with_images_uses_first_image_as_cover`.
- [ ] **Step 2: Run** `pytest tests/test_projects_editing.py -q` -> FAIL.
- [ ] **Step 3: Implement.** Validate everything first, then write in one transaction; delete removed files only after commit. Video link accepted if YouTube (`youtube.com/watch?v=`, `youtu.be/`) or Loom (`loom.com/share/<id>` or `/embed/<id>`), mirroring `frontend/src/lib/media.ts`.
- [ ] **Step 4: Run** the backend gate -> pass. Re-take `docs/design/screenshots/feed/ours-1440.png` (on the test data) and note in a feed `MATCH.md` which sample covers changed under the new cover rule.
- [ ] **Step 5: Commit** `feat(backend): add, edit and delete your own projects`

### Task 3: Add-project page `/new`

**Files:**
- Create: `frontend/src/app/[locale]/new/page.tsx` (server: `getCurrentUser()`; logged out -> `/login?next=/new`; company -> explanation box), `frontend/src/components/editor/ProjectForm.tsx` (client, used by Task 4 too), `frontend/src/components/editor/ImagePicker.tsx`, `frontend/src/components/editor/TagsInput.tsx`, `frontend/src/lib/project-errors.ts` (`projectErrorField(code)`, `projectErrorKey(code)`, `PROJECT_ERROR_CODES`), `frontend/src/lib/upload.ts` (`uploadImage(file): Promise<ApiResult<{id: string; url: string}>>`, browser fetch with FormData)
- Modify: `frontend/src/components/SiteHeader.tsx` ("Loyiha qo'shish" for developers), messages (`Editor` and `EditorErrors` namespaces in `projects.json`)
- Test: `frontend/tests/project-errors.test.ts`

**Interfaces:**
- Consumes: Task 2 API and codes; `TextField`, `Banner`, `ProjectCard` (live preview from the form state; give it a no-link option so the preview is not a dead link), `clientPatch`/`clientPost`.
- `ProjectForm({ mode: "create" } | { mode: "edit", project: EditableProject, username: string })`.

- [ ] **Step 1: Write the failing test** `project-errors.test.ts`: every code -> its field (`media_required`/`invalid_images` -> `images`; `developers_only`, unknown, `constructor` -> `form`); every code has a message in uz/ru/en.
- [ ] **Step 2: Run** `npm test -- project-errors` -> FAIL.
- [ ] **Step 3: Implement** per mockup screen 4 (`docs/design/2026-11-17-screens-mockup.html`, #s-add) without step 1: form left, sticky feed-card preview right on desktop, below on tablet/phone; `maxLength` per field; images upload on pick with progress and per-image error, remove and move left/right; Publish disabled while uploading or pending; success -> `router.push(path)`.
- [ ] **Step 4: Run** lint, test, build -> clean / pass / compiled.
- [ ] **Step 5: Visual gate**: screenshots 1440 / 768 / 390 of `/new` (empty and filled with a field error) vs mockup screen 4 captures in `docs/design/screenshots/add-project/`, `MATCH.md`, advisor compares. Flow: publish with a video only; with 2 images; double click sends one request; company sees the explanation.
- [ ] **Step 6: Commit** `feat(frontend): the add-project page`

### Task 4: Edit and delete

**Files:**
- Create: drawing in `docs/design/2026-11-17-screens-mockup.html` (screen 4b: edit page header with Save and Delete, and the delete confirmation), `frontend/src/app/[locale]/[username]/[slug]/edit/page.tsx` (404 unless `username` is the viewer's; loads `GET /me/projects/{slug}` with the cookie), `frontend/src/components/editor/DeleteProject.tsx`
- Modify: `frontend/src/components/projects/ProjectView.tsx` (owner sees "Tahrirlash", not for samples; samples show Delete in place of Edit), messages
- Test: none new (pure UI); Review Focus 5 is checked with curl in Step 3.

- [ ] **Step 1: Draw** screen 4b, capture `design-*.png`.
- [ ] **Step 2: Implement**; delete -> confirm -> `DELETE` -> `router.push("/<username>")`.
- [ ] **Step 3: Run** lint, test, build; curl with another user's session on `/<owner>/<slug>/edit` -> 404.
- [ ] **Step 4: Visual gate** vs screen 4b and screen 4; flow: edit title (URL unchanged), remove an image, delete a project, delete a sample (Bek's account on the test data).
- [ ] **Step 5: Commit** `feat(frontend): edit and delete your projects`

### Task 5: Profile photo

**Files:**
- Modify: `backend/app/media/router.py` (`PUT /api/v1/me/avatar` raw body -> 512 px square, sets `avatar_key`, deletes the old file; `DELETE /api/v1/me/avatar`), `backend/app/users/schemas.py` (`avatar_url` built from `avatar_key`), `backend/app/projects/schemas.py` (`Author.avatar_url: str | None`), `frontend/src/components/profile/ProfileForm.tsx` (photo picker at the top), `ProfileCard.tsx`, `ProjectCard.tsx`, `ProjectView.tsx` (photo instead of initials when set), messages
- Test: `backend/tests/test_media.py` (add rows)

- [ ] **Step 1: Failing tests**: `test_avatar_upload_sets_square_photo` (stored 512x512, profile `avatar_url` set), `test_avatar_replace_deletes_old_file`, `test_avatar_delete_clears_it`, `test_avatar_company_allowed` (both account types have photos).
- [ ] **Step 2-4:** run (FAIL), implement, run the backend and frontend gates.
- [ ] **Step 5: Visual check**: profile, card and project page with a photo at 1440 and 390; add to the existing MATCH.md files.
- [ ] **Step 6: Commit** `feat: profile photo`

### After the tasks (orchestrator)

DEFERRED for deploy: a docker-compose volume for `media/`, and the backup plan must include it.

Full gates; one Opus branch review (security of uploads and ownership first); fixes and re-check; push, PR, CI; merge is Bek's. Then Bek can delete the 29 samples from his account.
