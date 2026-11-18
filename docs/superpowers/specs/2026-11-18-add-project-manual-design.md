# Add project, part 1: add, edit and delete by hand - Design

Date: 2026-11-18. Spec step 2 (`2026-11-17-project-house-design.md` sections 8, 9 item 3, 10, D1-D3,
D17). Part 2 (GitHub import, ownership check, auto-fill from GitHub data) follows this one.

## Intent

A logged-in user publishes their own project, using the fixed card fields, a video link and up to
6 uploaded images, then edits or deletes it later. The project shows on the feed and on their
profile like any other. Friends can add projects before GitHub login is registered, and Bek gets the
delete button he will use to remove the 29 samples.

## Bek's decisions (2026-11-18)

- Order: manual add / edit / delete first; GitHub import next (part 2).
- Auto-fill (part 2): GitHub's own data first (name, description, languages, license); the AI
  README summary is added once Bek has an AI API key.
- Images: saved to disk now behind one small storage module; switched to Cloudflare R2 at deploy.

## Goals

- `/new`: the add form (mockup screen 4 layout without the GitHub step), with a live feed-card
  preview; publishing creates the project and opens its page.
- Edit your own project (`/<username>/<slug>/edit`), delete it with a confirmation.
- Up to 6 images per project: JPEG, PNG or WebP, max 5 MB each, resized and re-encoded by the
  backend.
- Header gets "Loyiha qo'shish" (the feature now exists).
- The owner sees "Edit" on their project page.

## Non-goals (later)

GitHub import, ownership check and auto-fill (part 2); AI summary; Telegram / Open Graph preview
(step 3); drafts (nothing is saved until Publish); GIF uploads (re-encoding drops animation);
drag-to-reorder (arrow buttons instead); co-authors.

## Anti-goals

- Never store or serve an uploaded file as the user sent it: every image is decoded and re-encoded,
  so no metadata (GPS) or hidden payload survives.
- No upload may be read by Next.js in one large request (Next can silently truncate bodies over
  10 MB, `proxyClientMaxBodySize`).

## Approaches considered (images; Claude's call)

| | Approach | Trade-off | Picked |
|---|---|---|---|
| A | Each image uploaded on its own as soon as it is picked; publish sends the upload ids | Small requests, progress per image; unused uploads must be cleaned | **yes** |
| B | One multipart request with the fields and all images | Atomic, but up to 30 MB through the Next layer (10 MB buffer cap, silent truncation) | no |
| C | Images as links to elsewhere | Spec D3 says images are uploaded | no |

## Design

### Backend

1. **Storage module** `app/media/storage.py`: `save(data: bytes, ext: str) -> key`, `url(key) -> str`,
   `delete(key)`. Disk implementation under `MEDIA_ROOT` (setting, default `backend/media/`,
   gitignored), served read-only at `/api/v1/media/<key>` (so the existing `/api/*` rewrite reaches
   it), long cache headers. R2 replaces only this module at deploy.
2. **Uploads**: table `uploads(id uuid pk, owner_id fk users ON DELETE CASCADE, key text,
   created_at)` (migration 0005). `POST /api/v1/me/uploads` (raw body, one image): login required,
   Origin check (existing middleware), max 5 MB, JPEG/PNG/WebP decoded with Pillow, decompression-
   bomb limit, longest side resized to 1600 px, saved as WebP without metadata. Returns
   `{id, url}`. On each upload the user's own uploads older than 24 h that were never used are
   deleted (rows and files), so no cron is needed.
3. **Own projects** (all login + Origin check; 404 for a slug that is not yours):
   - `POST /api/v1/me/projects` creates; `GET /api/v1/me/projects/{slug}` returns the edit data;
     `PATCH /api/v1/me/projects/{slug}` changes any subset; `DELETE /api/v1/me/projects/{slug}`.
   - Fields and rules (spec section 8; lengths are Claude's calls, Bek can override):

     | Field | Rule |
     |---|---|
     | title | required, 1-80 |
     | one_line_problem | required, 1-160 |
     | short_description | required, 1-1000 |
     | result | 0-160 |
     | field | required, one of the fixed list |
     | tech_stack | 1-12 tags, each 1-30, duplicates removed |
     | github_url | empty or `https://github.com/<owner>/<repo>` |
     | live_url | empty or `http(s)://`, max 200 |
     | role | 0-120 |
     | video_url | empty or a YouTube / Loom link the player understands |
     | images | ordered list of up to 6 items: upload ids (new) or existing media ids (kept) |

     License is not asked in part 1 (stored NULL; part 2 reads it from GitHub).
   - "Video or at least one image" is checked on create and after every edit.
   - One error code per field, same shape and style as `PATCH /auth/me`; any failure writes nothing.
   - Slug: from the title (`slugify`, `[a-z0-9-]`), unique per owner with `-2`, `-3`, ...; a title
     with no Latin letters gives `project`, `project-2`, ... The slug never changes on edit, so
     shared links keep working.
   - Media rows: the video at position 0 (as the seed does), images after it in the given order.
     Upload rows are consumed (deleted) when attached; media files of removed images and of a
     deleted project are deleted from storage (external sample URLs are left alone).
   - `published_at` = now on create.
4. Deleting works for any project you own, including the samples now owned by Bek.

### Frontend

- **`/new`** (login required, else `/login?next=/new`): mockup screen 4 without step 1, two columns
  on desktop (form + sticky preview), one column on tablet/phone (preview below). Fields as above,
  field picker from the fixed list, tags input, video link with help text, image picker with
  thumbnails, remove and move-left/right buttons, upload progress and per-image errors. Publish is
  disabled while uploads run; one request per click. On success: go to the new project page.
- **`/<username>/<slug>/edit`**: the same form filled in; Save and Delete. Delete asks for
  confirmation, then goes to your profile.
- Project page: "Tahrirlash" (Edit) for the owner. Header: "Loyiha qo'shish" for logged-in users.
- Drawings: screen 4 covers the form; the edit page header with Delete and its confirmation is drawn
  first in the approved system, then built (advisor gate per page).
- Texts in uz / ru / en.

### New dependencies

Backend: `Pillow` (decode, resize, re-encode images). Uploads are raw request bodies, so no multipart
library is needed and the 5 MB cap is enforced while the bytes arrive (advisor, 2026-11-18).

## Calls made after the builder check (Claude's, Bek can override)

- **Who may publish:** developer accounts only (spec section 3: companies browse, like, comment
  and message). A company gets 403 `developers_only` from the API; the header button is shown to
  developers only; a company opening `/new` sees a short explanation. Email confirmation is not
  required (no email provider yet; bad content is handled by reports, spec section 10).
- **Samples:** owned samples get Delete only, no Edit (Bek wants to remove them; their data
  breaks the new rules: a sample with no tags, gif/mp4 "videos"). PATCH on a sample row returns
  403 `sample_read_only`; the project page shows no Edit button for samples.
- **Storage keys:** `project_media` gets a nullable `storage_key` (migration 0005). The API builds
  the URL from the key at response time, so switching to R2 does not leave rows pointing at disk.
  Only rows with a key have files to delete; sample rows (external URLs, no key) are left alone.
- **Video:** the link is stored in `demo_video_url` (the column the project page links to) and as
  a `kind=video` media row at position 0; images follow. The card cover is the first media item that
  has a picture (an image, or a YouTube video's thumbnail), so a Loom video plus images shows the
  first image instead of a blank cover.
- **Ownership of ids:** every upload id in a request must belong to the caller and be unused; every
  kept media id must belong to the project being edited; otherwise 422 `invalid_images`. An upload
  is consumed in one statement (`DELETE ... WHERE id = ANY(...) AND owner_id = :me RETURNING`), so it
  cannot attach to two projects.
- **Upload limits:** the 5 MB cap is enforced while the file streams in (read in chunks, stop at
  5 MB + 1 byte, 413 `image_too_large`); at most 12 unused uploads per user (429
  `too_many_uploads`). Cleanup on every upload removes **anyone's** unused uploads older than 24 h
  (small batch per call), not only the caller's.
- **Media route:** accepts only keys matching `^[0-9a-f]{32}\.webp$` (no path traversal), always
  sends `Content-Type: image/webp` and `X-Content-Type-Options: nosniff`.
- **Edit page owner:** `/<username>/<slug>/edit` shows the form only when `<username>` is the
  logged-in user; anyone else gets 404 (the `/me/projects/{slug}` API only knows the caller).
- **Profile photo:** the profile design moved photo upload here because it needs this storage. It
  is the last task of part 1: an upload on `/settings/profile` (same image rules, 512 px square
  crop), stored in a new nullable `users.avatar_key` (migration 0005); the API keeps returning
  `avatar_url`, built from the key; the profile, cards and project page show it instead of initials.

## Left to the builder

Component split, the tags input details, exact cache headers, how progress is shown, test data.
