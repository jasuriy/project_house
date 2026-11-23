# Prostagram: upload page and project page

Date: 2026-11-23. Status: APPROVED by Bek 2026-11-23 (post language: several; text limits, extra catalog groups and the four technical choices in section 9 confirmed).
Mockups (binding for desktop look, 1280 x 853): `docs/mockups/upload-page.png`, `docs/mockups/project-page.png`.
Evidence tags: [V] verified, [C] third-party source, [D] derived, [A] assumption, [U] unknown.

## 1. What we are building

Prostagram is a fresh start of the app (old name Project House). Nothing is inherited from the old
code except what Bek named: the stack (FastAPI, Next.js, PostgreSQL, Cloudflare R2), the old R2
bucket, the old Neon database, the old Modal app and the old Vercel project (section 11).

This spec covers two pages, built one after the other:

1. **Upload page** (`/new`): a form where a person describes a project, uploads a demo video and links
   a GitHub repo. Built first.
2. **Project page** (`/projects/<slug>`): shows a rendered project. Built after the upload page is
   approved.

Out of scope now: login, explore page, editing a rendered project, likes, comments, profiles.

## 2. Decisions taken with Bek (2026-11-23)

| # | Decision |
|---|---|
| D1 | Sample project for testing: `reflex-dev/reflex` (values in section 10). |
| D2 | Build the two mockups exactly (layout, look). The page shows real form data, not the mockup text. |
| D3 | Name in the header: **Prostagram**. Logo: the purple squares icon from the mockups. |
| D4 | "Try demo" plays the uploaded video. No autoplay. When the video ends it stops; to watch again, click "Try demo" again. No live-demo URL field. |
| D5 | Before playback the video box shows the first frame of the video, no play icon, no caption. The duration badge (for example "0:58") stays. During playback the player controls are shown (pause, seek, volume, fullscreen). |
| D6 | No login for now. The author is static: name "Jasurbek", photo `profile_photo.jpg` (640 x 640 JPEG [V]). The header avatar, GitHub icon and "Explore projects" are static and do nothing yet. |
| D7 | Post language: one or more of English, O'zbek, Русский (the languages the post is written in). Shown in "At a glance" as "Languages" (for example "English & O'zbek"). |
| D8 | Category: one choice from a fixed list (section 5.2). Shown in the breadcrumb. |
| D9 | "AI powered": the user ticks it. Never automatic. Shown in the badge ("LIBRARY • AI POWERED"). |
| D10 | "How it works": optional text. |
| D11 | Deliverable: several choices from a fixed list. Rendered in "What you get" and in "At a glance > Delivery". |
| D12 | Project type adds "Mobile app". |
| D13 | Start date and finish date, with "still ongoing" instead of a finish date. Optional. Shown as "Timeline" in "At a glance". |
| D14 | Tech stack: a ready catalog where each technology already has its group (Languages, Frontend, Backend & AI, Storage, ...). The user may also type a technology that is not in the catalog. |
| D15 | Limitations: optional. |
| D16 | Video limit: 300 MB. Video goes to R2 directly from the browser (section 7). |
| D17 | Video playback: private bucket, short-lived signed links (section 7.3). |
| D18 | Repository preview: fetched from GitHub once when the repo is linked, then stored in our database (section 8). |
| D19 | Code is written on `main`. Nothing is pushed until both pages are done, because a push to `main` replaces the live site at once. |
| D20 | On the push day: the old R2 bucket is emptied, the old Neon tables are dropped, the old Modal app and Vercel project are reused (section 11). |
| D21 | Old files (`backend/`, `frontend/`, `docs/` except this spec and the mockups, `seed/`, `docker-compose.yml`, `README.md`) are deleted in the first commit; a new README replaces the old one. The local `.env` is kept. The new code again lives in `backend/` and `frontend/` (the Vercel project builds from `frontend/`). |
| D22 | Friends get the link of the new app to test it. |

## 3. Choices made by Claude (technical, Bek may object)

| # | Choice | Why |
|---|---|---|
| T1 | A draft is created on the server at the first edit; every change autosaves about 1 s after typing stops; the header shows "Draft saved". The draft id goes into the address (`/new?draft=<id>`), so a page reload or a copied link opens the same draft. | The mockup shows "Draft saved"; without login, the address is the only way back to a draft. |
| T2 | "Render project" checks all required fields; if one is missing it scrolls to it and shows the error. When everything is valid the project becomes published and the browser opens its project page. | The mockup shows "Ready to render" and a "Render project" button. |
| T3 | Project ids are random UUIDs. | Without login, a guessable number would let anyone edit someone else's draft by counting. |
| T4 | Empty optional fields hide their element on the project page (How it works card, Limitations card, Timeline row). | No empty boxes. |
| T5 | A custom technology typed into "Programming languages" goes to the Languages row; one typed into "Frameworks & tools" goes to an "Other" row. | The field tells us it is a language; a tool's group is not known. |
| T6 | Video formats: MP4 and WebM only. | Every browser plays them; MOV plays reliably only in Safari [A]. |
| T7 | First frame: the browser takes a still image of the video's first frame when the video is chosen and uploads it next to the video as a JPEG. | Some mobile browsers (Safari on iPhone) do not draw a video's first frame without a poster image [A, checked during the build]. |
| T8 | Tablet and phone layouts are designed by Claude in the same style; the mockups are desktop only. | No mockup exists for them. |
| T9 | Tech logos from the `simple-icons` package; interface icons from `lucide`. Exact versions pinned in the plan. | The mockup shows brand logos and line icons. |
| T10 | Visual check: screenshot at 1280 next to the mockup, then 1440, 768 and 390. | Mockups are 1280 x 853 [V]. |

## 4. Upload page (`/new`)

Layout from `docs/mockups/upload-page.png`:

- **Header:** logo + "Prostagram"; centre breadcrumb "home > Workspace / New project"; right "Draft
  saved" (green check, only after the first save) and the primary button "Render project ->".
- **Title:** "Build your project page", subtitle "Everything someone needs to understand your project."
- **Left nav (sticky):** Project details, Demo & links, Technology, Setup & delivery. Clicking scrolls
  to the section. A green check appears when all required fields of that section are filled.
- **Middle column:**
  - *Project details:* Project name*, Short description*, Project type* (chips, one choice),
    **AI powered** (tick, D9), **Category*** (dropdown, D8), **Post language*** (chips + dropdown, several, D7),
    What problem does it solve?*, What is the outcome?* (two textareas side by side),
    Who is it for? (audience)*.
  - *Technology stack:* Programming languages* (chips + dropdown), Frameworks & tools* (chips +
    dropdown). Both search the catalog and accept a typed custom value (D14).
  - *Setup & delivery:* Deliverable* (chips + dropdown, several, D11), Getting started*,
    Requirements*, License*, Status*, Limitations (optional, D15), **How it works** (optional, D10),
    **Started** / **Finished** or **still ongoing** (optional, D13).
- **Right column:**
  - *Demo video:* drop zone / file picker. After upload: first-frame preview with duration badge,
    file name, size and duration, "Upload complete", "Replace". While uploading: a progress bar.
  - *GitHub repository:* URL input; after linking, "Repository connected" and the preview (root files
    and the first lines of the README).
  - *Ready to render:* four checks: Project details complete, Demo video uploaded, Repository linked,
    Technology stack added. Text: "Your showcase will include outcomes, video, code, and setup details."
  - Footnote: "Review your details, then click Render project."

New fields (marked bold above) use exactly the mockup's field styles.

### 4.1 Required fields

Required: name, short description, project type, category, post language, problem, outcome, audience,
at least one programming language, at least one framework or tool, at least one deliverable, getting
started, requirements, license, status, demo video, GitHub repo.
Optional: AI powered (default off), limitations, how it works, dates.

Text limits: name 80, short description 160, audience 120, problem and outcome 600, getting started,
requirements, limitations 300, how it works 600 characters. (Bek confirmed 2026-11-23.)

## 5. Fixed lists

### 5.1 Project type, status, deliverable, license, post language

| List | Values |
|---|---|
| Project type | Web app, Website, AI model, Library, API, Mobile app |
| Status | Idea, Prototype, Beta, Live, Archived |
| Deliverable | Source code, Hosted web app, Mobile app, Docker setup, Package (PyPI/npm), API, Self-hosted deployment |
| License | MIT, Apache-2.0, GPL-3.0, AGPL-3.0, BSD-3-Clause, MPL-2.0, Proprietary, None |
| Post language | English, O'zbek, Русский |

### 5.2 Category

AI & Machine Learning, Web Development, Mobile Development, Developer Tools, Data & Analytics, Games,
Education, Productivity, Finance, Health, Design, Security, IoT & Hardware, Other.

### 5.3 Tech catalog

One file in the backend is the only source of all lists above and of the catalog; the frontend reads
them from `GET /api/v1/catalog`. Each catalog entry: name, group, icon id. Groups: Languages,
Frontend, Backend & AI, Storage, Mobile, DevOps & Tools. The project page shows a group row only
when it has entries. Bek reviews the catalog entries in the implementation plan.

## 6. Project page (`/projects/<slug>`)

Layout from `docs/mockups/project-page.png`. Data source of each element:

| Element | Source |
|---|---|
| Breadcrumb "Projects / <Category>" | category |
| Badge "WEB APP • AI POWERED" | project type, plus "AI POWERED" when ticked |
| Title, subtitle | name, short description |
| "By Jasurbek • <Status>" with photo | static author (D6), status |
| Try demo | plays the video (D4) |
| View source | GitHub repo URL |
| The problem / The outcome | problem / outcome |
| What you get | deliverables, one tick per item |
| Video box | first frame, duration badge, controls during playback (D5) |
| At a glance | Type, For (audience), Languages (post languages joined with " & "), Status, Delivery (deliverables joined with " + "), Timeline (dates, hidden when empty) |
| Technology stack | catalog groups; custom entries under "Other" |
| Repository preview | stored snapshot (section 8), "Open on GitHub" |
| Bottom cards | How it works (hidden when empty), Getting started, Requirements, Limitations (hidden when empty), License |

## 7. Video upload (system design)

### 7.1 Why the video never passes through our servers

- A Vercel function accepts at most 4.5 MB per request body [C: vercel.com/docs/errors/FUNCTION_PAYLOAD_TOO_LARGE].
- A Modal web endpoint request may run at most 150 s [C: modal.com/docs/guide/webhook-timeouts]; a
  300 MB upload on a slow connection takes longer.
- Sending bytes through the backend also pays for the traffic twice (in, then out to R2).

So the browser uploads straight to R2 with a **presigned URL**: a one-time link, signed by our backend
with the R2 secret, that allows exactly one upload of one file to one place for a few minutes.

### 7.2 Flow

```
1. browser -> backend   POST /api/v1/projects/{id}/uploads/video/url  {file name, type, size}
2. backend              checks: type is video/mp4 or video/webm, size <= 300 MB (314,572,800 bytes)
                        signs a PUT URL for key videos/{project_id}/{random}.{ext}, valid 15 min,
                        with the exact Content-Type and Content-Length signed in
3. browser -> R2        PUT the file to that URL (progress bar from upload events)
4. browser -> backend   POST /api/v1/projects/{id}/uploads/video/complete  {key, file name, duration}
5. backend -> R2        HEAD the object: exists, size and type match; then saves the key on the
                        project and deletes the previous video, if any
```

The first-frame JPEG (T7) uses the same flow (`uploads/poster/...`) with key
`posters/{project_id}/{random}.jpg`, max 2 MB.

Verified live on R2 (2026-11-23) with the 31.8 MB reflex video: a PUT with a different size or
content type than signed is refused with 403 [V]; the real upload returns 200 [V].

### 7.3 Playback

The bucket stays private. When the project page is rendered, the backend signs a GET URL for the video
and the poster, valid for 1 hour. The browser plays the video from R2 directly. Seeking works because
R2 answers byte-range requests [V: a signed GET with `Range: bytes=0-99` returned 206, 2026-11-23].

- The project page is rendered fresh on every request and never cached (by Next.js or Vercel);
  a cached page would carry expired links and the video would fail with 403.
- If the tab stayed open longer than 50 minutes, clicking "Try demo" first asks the backend for a
  fresh link (`GET /api/v1/projects/by-slug/{slug}/video-url`), then plays.

### 7.4 R2 setup (once)

Both are done by Bek in one Cloudflare dashboard session (Claude gives the exact steps and the JSON):

- A new R2 API token limited to the old bucket `projecthouse-images`, permission "Object Read &
  Write". The key goes into the local `.env`, never into git.
- A CORS rule on the bucket (dashboard: bucket > Settings > CORS policy) allowing `PUT` and `GET`
  from `http://localhost:3000` and the Vercel domain. Without it the browser blocks step 3. It is
  added in the dashboard because an object-only token is not meant to change bucket settings
  [A: Cloudflare separates "Admin" and "Object" token permissions; the dashboard path works either way].

## 8. Repository preview

When the user links a repo, the backend calls the GitHub API once (repo info, root folder list, README)
and stores a snapshot on the project: full name, public/private, description, default branch, root
entries (name and type), the first 3 lines of the README, fetch time. The project page reads only the
snapshot. Reason: GitHub allows 60 unauthenticated requests per hour [V: api.github.com/rate_limit
returned limit 60]. Linking again refreshes the snapshot. Only public repos can be linked.

## 9. Backend shape

- **One address for the browser.** The browser only talks to the Next.js site; requests to
  `/api/*` are forwarded by Next.js (a rewrite) to the FastAPI backend. Why: no cross-origin (CORS)
  rules needed on the API, and the later login cookie works on one domain. The alternative, the
  browser calling the Modal URL directly, needs CORS on FastAPI and a cross-site cookie later.
  Video bytes are the exception: they go browser -> R2 directly (section 7).
- FastAPI, SQLAlchemy 2 (async), Alembic, PostgreSQL. Exact versions pinned in the plan.
- One table `projects` (UUID id, every form field above, video and poster keys, video size and
  duration, repo URL and snapshot as JSON, created/updated times). `published_at` is NULL for a
  draft and set when published; `slug` is unique and set only when published.
- Endpoints (`/api/v1`): `GET /catalog` (all lists, text limits, upload rules, tech catalog);
  `POST /projects` (create draft); `GET /projects/{id}` (reopen a draft); `PATCH /projects/{id}`
  (autosave, drafts only); `POST /projects/{id}/uploads/{video|poster}/url` and `.../complete`;
  `POST /projects/{id}/repo`; `POST /projects/{id}/publish` (the "Render project" button);
  `GET /projects/by-slug/{slug}` (project page, step 5).
- Every project response carries `missing_fields`, computed by the backend. The upload page's
  section checks and "Ready to render" list read it, and publishing re-checks it, so the rule of
  what is required exists in one place.
- One error shape for every error: `{"error": {"code": "...", "message": "..."}}`.
- Tests: pytest against a real local PostgreSQL; R2 and GitHub are faked in tests.
- `docs/architecture.md` is written alongside the code in plain language, so Bek can explain every part
  (request flow, tables, upload design, why each choice) in an interview.

## 10. Reflex sample values (task 1 output)

| Field | Value | Source |
|---|---|---|
| Name | Reflex | README [V] |
| Short description | Web apps in pure Python. | pyproject [V] |
| Project type | Library | README "Reflex is a library ..." [V] |
| AI powered | no | [D] it is a web framework |
| Category | Developer Tools | [D] |
| Post language | English | |
| Problem | Python developers have to learn JavaScript to build a web frontend. | [D] from README "no need to learn Javascript" |
| Outcome | Frontend and backend written in Python; the app runs at localhost:3000 with fast refresh. | [D] paraphrase of README |
| Audience | Python developers | [D] |
| Programming languages | Python, TypeScript, JavaScript | GitHub languages API [V] |
| Frameworks & tools | Starlette, Granian, Socket.IO, Redis, Radix UI, Plotly, Recharts | pyproject dependencies [V] |
| Deliverable | Source code, Package (PyPI/npm) | README PyPI badge [V] |
| Getting started | uv init -> uv add reflex -> uv run reflex init -> uv run reflex run | README [V] |
| Requirements | Python 3.11+ | pyproject requires-python [V] |
| License | Apache-2.0 | GitHub API [V] |
| Status | Beta | pyproject classifier "4 - Beta" [V] |
| Limitations | (empty) | not stated in the README |
| How it works | Define the UI in Python, keep state in a class, update it from event handlers. | [D] paraphrase of README example section |
| Started / finished | 2022-10-25 / ongoing | GitHub API [V] |
| Demo video | reflex-demo.mp4, 33,372,331 bytes, 0:58, H.264 + AAC, 2512 x 1440, faststart | ffprobe [V] |
| Repo | https://github.com/reflex-dev/reflex | [V] |

## 11. Push day (cutover)

Done only after both pages pass review, in this order, each step confirmed with Bek:

1. Back up the old Neon database (`pg_dump`).
2. Empty the R2 bucket `projecthouse-images` (all old images).
3. Drop every old table in Neon, including `alembic_version` (otherwise the new migrations collide
   with the old migration history); run the new migrations.
4. Update the Modal secret with the new setting names; redeploy the Modal app.
5. Update the Vercel environment variables (backend address; remove the old login flag). The
   Vercel project's root directory stays `frontend`.
6. Push to `main`; Vercel deploys the new frontend on the old link.
7. Check the R2 CORS rule includes the Vercel domain; check the live upload and project page.

## 12. Order of work

1. Clean the repo (D21) and scaffold the new backend, frontend and local PostgreSQL.
2. R2 token and CORS rule (Bek + Claude).
3. Backend for the upload page, with tests.
4. Upload page frontend, matched to the mockup, screenshots reviewed.
5. Project page (backend endpoint + frontend), matched to the mockup, screenshots reviewed.
6. Push day (section 11).

Each step ends with a report to Bek before the next starts.

## 13. Deferred

- Old local Docker setup of the previous app (incident 2026-11-23): the first `docker compose up` of the
  new compose file replaced the old container `project_house-db-1` (same compose project name). Its
  data volume `project_house_pgdata` is intact [V]; the stopped containers `project_house-frontend-1`
  and `project_house-backend-1` still exist. The old local site can only return by checking out d55f266.
  The new compose file now has its own project name (`prostagram`). Old volume and containers: removed
  later if Bek wants.
- CI: the old GitHub Actions workflow was deleted with the old code; a new one is not set up yet.
- Orphan videos (a draft abandoned after upload): not cleaned up yet.
- Rate limiting and abuse protection: not needed while only friends use the app (Bek, 2026-11-23).
