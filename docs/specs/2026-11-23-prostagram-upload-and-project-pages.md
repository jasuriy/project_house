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
| D4 | ~~"Try demo" plays the uploaded video.~~ Replaced by D28. No autoplay. When the video ends it stops; to watch again, click "Try demo" again. No live-demo URL field. |
| D5 | ~~(duration badge and hidden controls replaced by D28)~~ Before playback the video box shows the first frame of the video, no play icon, no caption. The duration badge (for example "0:58") stays. During playback the player controls are shown (pause, seek, volume, fullscreen). |
| D6 | No login for now. The author is static: name "Jasurbek", photo `profile_photo.jpg` (640 x 640 JPEG [V]). The header avatar, GitHub icon and "Explore projects" are static and do nothing yet. |
| D7 | Post language: one or more of English, O'zbek, Русский (the languages the post is written in). Shown in "At a glance" as "Languages" (for example "English & O'zbek"). |
| D8 | Category: one choice from a fixed list (section 5.2). Shown in the breadcrumb. |
| D9 | ~~"AI powered": the user ticks it. Never automatic. Shown in the badge ("LIBRARY • AI POWERED").~~ Replaced by D25. |
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
| D23 | Video box is 16:9 on both pages (Bek, 2026-11-23), not the mockup's wide 452:177 shape, so 16:9 demo videos show without side bars. |
| D24 | No drafts (Bek, 2026-11-24): nothing is stored before "Render project". Closing the page, F5 or leaving it for another page of the site gives an empty form; an unfinished form is not wanted. The form lives in the browser, files wait in R2's temporary folder `uploads/` (a bucket lifecycle rule deletes them after 1 day), and Render sends one request that creates the published project. The mockup's "Draft saved" status is removed. The project page's logo links to the home page `/`. Replaces T1. |
| D25 | Form trimmed (Bek, 2026-11-24): "AI powered" (D9) and "Who is it for? (audience)" are removed from the upload page, the project page (badge, "For" row) and the database (migration 0003, values deleted). The GitHub repository is optional: without it the project page shows no "View source" and no repository preview, and the technology card takes the full row; a link that is typed but not connected stops Render ("Connect the repository (press Enter) or clear the link"). "Repository linked" is removed from the Ready card. Getting started and Requirements stay required and get example text in the box ("e.g. npm install, npm run dev", "e.g. Python 3.11+, Node 20"). |
| D26 | Tech stack limits (Bek, 2026-11-24): at most 7 programming languages and at most 5 frameworks & tools (was 20 each). The form stops adding at the limit ("At most N"); the server refuses longer lists. The mockup data (6 tools) and the Reflex sample below (7 tools) are older than this rule and are kept as display data only. |
| D27 | Upload page layout (Bek, 2026-11-24): the left section nav is removed, and the page is no longer a centred 1280 px column: it fills the screen width, its edges in line with the header's logo and Render button. Two columns (form | video, repository, ready) keep the 511:492 ratio. The project page also fills the width (same day, Bek): its rows keep their column ratios, so on wide screens the video grows and the space under "At a glance" grows with it. |
| D28 | Project page redundancy removed (Bek, 2026-11-24): no "Try demo" (it duplicated the video's own play control) and no "View source" (it duplicated "Open on GitHub" in the repository preview). The video shows the browser's own controls from the start (play, time, volume, fullscreen), never starts by itself, and returns to its first frame at the end; the separate duration badge is removed (the controls show the time). |
| D29 | Redesign (Bek, 2026-11-25), designs in the canvas https://claude.ai/artifact/WLaPPbpz4Roh7KNgiAEZku: the project page is "D7" (one screen: details, facts, Built with and the repository preview on the left; video, author and the three-part story on the right) and the upload page is "U4", the same page edited in place (every value typed or picked where it shows). Removed from the form, the pages and the database (migration 0004, values deleted): Post language (supersedes D7) and Get it running, that is getting started, requirements and limitations (supersedes D15 and D25's examples), because the repository's README already shows how to run it. The repository preview (D18) takes Get it running's place; the GitHub button under the video is gone ("Open on GitHub" in the preview does that job, D28 rule). The short description gets three lines of room. The upload header keeps a five-part ready bar with "N of 5 ready" (Video, Story, About, Facts, Built with). With no dates, the project page keeps the Timeline cell and shows a dash. Desktop first; phone and tablet are designed after Bek approves desktop. Sections 4 and 6 below describe the earlier mockup layout; where they differ, D29 wins. |
| D30 | Phone and tablet (Bek, 2026-11-25: wait for the phone design before deploying; design it and build it). Below 1100px both pages are one column in this order: name card, video, author, story, facts, Built with, repository. The DOM follows that order (the desktop grid places the cards), so keyboards and screen readers meet them as a phone shows them; on desktop Tab now goes name card, video, story, facts, Built with, repository. Phone (<640px): title 28px, body 16px (no iOS zoom in text fields); facts Status | License with Timeline on its own row; Built with labels above their chips; repository files above the README; choosers open as bottom sheets with a Done button; every control has a 44x44 touch area; the upload header shows "N/5" beside Render. |
| D31 | Upload page "U5" (Bek, 2026-11-25): a form, not edit in place. Every field has its label above it and a box of a fixed size (no field grows while typing); selects show an icon and a chevron; text fields show their character count in the label row; several choices show "N of M chosen" with removable chips under the box; Render marks an empty field with "Missing" beside its label and a red border. Each part is a section with an icon and a title. The sections stay where the project page shows them (the repository stays in the left column; a scroll is fine); the story's three fields sit side by side, as on the project page (Bek tried them one under another and chose side by side). |
| D32 | Feed on the home page (Bek, 2026-11-25): a grid of project cards, newest first (GET /api/v1/projects). A card shows the first frame, name, status, short description, type and category, as much of the stack as fits on one line, and the author; the whole card opens the project page. The search sits in the header and looks in the name, the description and the stack; the categories are one row of text tabs (desktop: the first 8 and More; narrower screens: all of them, scrolling sideways). Filters live in the address (?category=&q=). |
| D33 | Back on the project page (Bek, 2026-11-27): a text link "Back" with a left arrow in its own row above the content (not in the header). When the page before it in the tab is the feed, it steps back in history, so the feed returns with its filters and scroll; in every other case (a shared link opened fresh, the upload page after Render, another project, a browser without the Navigation API) it is a plain link to the feed. |

## 3. Choices made by Claude (technical, Bek may object)

| # | Choice | Why |
|---|---|---|
| T1 | ~~Server-side draft with autosave and `/new?draft=<id>`.~~ Replaced by D24 (2026-11-24). | |
| T2 | "Render project" checks all required fields in the browser (the list comes from the catalog); if one is missing it scrolls to it and shows the error. The server checks the same list again; when everything is valid the project is created and the browser opens its project page. | The mockup shows "Ready to render" and a "Render project" button. |
| T3 | Project ids are random UUIDs, chosen by the server before the row is written (the files are copied under the id first). | Not guessable, and known before the insert. |
| T4 | Empty optional fields hide their element on the project page (How it works card, Limitations card, Timeline row). | No empty boxes. |
| T5 | A custom technology typed into "Programming languages" goes to the Languages row; one typed into "Frameworks & tools" goes to an "Other" row. | The field tells us it is a language; a tool's group is not known. |
| T6 | Video formats: MP4 and WebM only. | Every browser plays them; MOV plays reliably only in Safari [A]. |
| T7 | First frame: the browser takes a still image of the video's first frame when the video is chosen and uploads it next to the video as a JPEG. | Some mobile browsers (Safari on iPhone) do not draw a video's first frame without a poster image [A, checked during the build]. |
| T8 | Tablet and phone layouts are designed by Claude in the same style; the mockups are desktop only. | No mockup exists for them. |
| T9 | Tech logos from the `simple-icons` package; interface icons from `lucide`. Exact versions pinned in the plan. | The mockup shows brand logos and line icons. |
| T10 | Visual check: screenshot at 1280 next to the mockup, then 1440, 768 and 390. | Mockups are 1280 x 853 [V]. |

## 4. Upload page (`/new`)

Layout from `docs/mockups/upload-page.png`:

- **Header:** logo + "Prostagram"; centre breadcrumb "home > Workspace / New project"; right the
  primary button "Render project ->". (The mockup's "Draft saved" is removed, D24.)
- **Title:** "Build your project page", subtitle "Everything someone needs to understand your project."
- ~~**Left nav (sticky):** Project details, Demo & links, Technology, Setup & delivery.~~ Removed (D27);
  the page fills the screen width.
- **Middle column:**
  - *Project details:* Project name*, Short description*, Project type* (chips, one choice),
    **Category*** (dropdown, D8), **Post language*** (chips + dropdown, several, D7),
    What problem does it solve?*, What is the outcome?* (two textareas side by side).
    (AI powered and audience removed, D25.)
  - *Technology stack:* Programming languages* (chips + dropdown), Frameworks & tools* (chips +
    dropdown). Both search the catalog and accept a typed custom value (D14). At most 7 languages and
    5 frameworks & tools (D26).
  - *Setup & delivery:* Deliverable* (chips + dropdown, several, D11), Getting started* and
    Requirements* (with example text, D25), License*, Status*, Limitations (optional, D15), **How it works** (optional, D10),
    **Started** / **Finished** or **still ongoing** (optional, D13).
- **Right column:**
  - *Demo video:* drop zone / file picker. After upload: first-frame preview with the browser's own player
    controls (no custom play button or duration badge, inspection finding 6),
    file name, size and duration, "Upload complete", "Replace". While uploading: a progress bar.
  - *GitHub repository (optional, D25):* URL input; after linking, "Repository connected" and the
    preview (root files and the first lines of the README). Emptying the box removes the link.
  - *Ready to render:* one check per form section: Project details complete, Demo video uploaded,
    Technology stack added, Setup & delivery complete ("Repository linked" removed, D25; Setup added
    and the "Your showcase will include..." line removed, inspection finding 1).
  - Footnote: "Review your details, then click Render project."

New fields (marked bold above) use exactly the mockup's field styles.

### 4.1 Required fields

Required (D29): name, short description, project type, category, problem, outcome, at least one
programming language, at least one framework or tool, at least one deliverable, license, status, demo video.
Optional: GitHub repo (D25), how it works, dates.

Text limits: name 80, short description 160, problem and outcome 600, how it works 600 characters.
(Bek confirmed 2026-11-23; getting started, requirements and limitations removed by D29.)

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
| Badge "WEB APP" | project type (the mockup's "AI POWERED" part removed, D25) |
| Title, subtitle | name, short description |
| "By Jasurbek • <Status>" with photo | static author (D6), status |
| The problem / The outcome | problem / outcome |
| What you get | deliverables, one tick per item |
| Video box | first frame, the browser's own controls from the start (D28) |
| At a glance | Type, Languages (post languages joined with " & "), Status, Delivery (deliverables joined with " + "), Timeline (dates, hidden when empty) |
| Technology stack | catalog groups; custom entries under "Other" |
| Repository preview | stored snapshot (section 8), "Open on GitHub"; hidden without a repo, the technology card then takes the full row (D25) |
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

Since D24 (2026-11-24) nothing is stored before Render:

```
1. browser -> backend   POST /api/v1/uploads/video/url  {type, size}
2. backend              checks: type is video/mp4 or video/webm, size <= 300 MB (314,572,800 bytes)
                        signs a PUT URL for the temporary key uploads/{random}/video.{ext}, valid
                        15 min, with the exact Content-Type and Content-Length signed in
3. browser -> R2        PUT the file to that URL (progress bar from upload events); the preview on
                        the page plays the person's own file from memory
   (the first-frame JPEG, T7, goes the same way to uploads/{random}/poster.jpg, max 2 MB)
4. browser -> backend   Render: POST /api/v1/projects  {all fields, video key, poster key, repo link}
5. backend              checks the fields; the keys must look like keys it handed out; HEAD the
                        video in R2 (exists, allowed type and size); reads GitHub itself; copies the
                        files inside R2 to videos/{project_id}/... and posters/{project_id}/...;
                        writes the row; then deletes the temporary originals
```

A form that is never rendered leaves its files in `uploads/`; the bucket's lifecycle rule (prefix
`uploads/`, delete after 1 day) removes them [V: Cloudflare R2 object lifecycle docs, prefix rules,
deletion within about 24 h of expiry]. R2 copies objects server-side and keeps the content type [V:
copy_object test, 2026-11-24].

Verified live on R2 (2026-11-23) with the 31.8 MB reflex video: a PUT with a different size or
content type than signed is refused with 403 [V]; the real upload returns 200 [V].

### 7.3 Playback

The bucket stays private. When the project page is rendered, the backend signs a GET URL for the video
and the poster, valid for 1 hour. The browser plays the video from R2 directly. Seeking works because
R2 answers byte-range requests [V: a signed GET with `Range: bytes=0-99` returned 206, 2026-11-23].

- The project page is rendered fresh on every request and never cached (by Next.js or Vercel);
  a cached page would carry expired links and the video would fail with 403.
- If the tab stayed open longer than 50 minutes, pressing play first asks the backend for a
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

When the user links a repo, the backend calls the GitHub API (repo info, root folder list, README) and
answers a preview, storing nothing (`POST /repos/preview`, D24). On Render the backend reads GitHub
again itself and stores the snapshot on the project: full name, public/private, description, default
branch, root entries (name and type), the first 3 lines of the README, fetch time. The project page
reads only the snapshot. Reason: GitHub allows 60 unauthenticated requests per hour [V: api.github.com/rate_limit
returned limit 60]. Linking again refreshes the snapshot. Only public repos can be linked.

## 9. Backend shape

- **One address for the browser.** The browser only talks to the Next.js site; requests to
  `/api/*` are forwarded by Next.js (a rewrite) to the FastAPI backend. Why: no cross-origin (CORS)
  rules needed on the API, and the later login cookie works on one domain. The alternative, the
  browser calling the Modal URL directly, needs CORS on FastAPI and a cross-site cookie later.
  Video bytes are the exception: they go browser -> R2 directly (section 7).
- FastAPI, SQLAlchemy 2 (async), Alembic, PostgreSQL. Exact versions pinned in the plan.
- One table `projects` (UUID id, every form field above, video and poster keys, video size and
  duration, repo URL and snapshot as JSON, created/updated times). Every row is a published project
  (D24): `slug` (unique) and `published_at` are always set (migration 0002).
- Endpoints (`/api/v1`): `GET /catalog` (all lists, text limits, upload rules, required fields, tech
  catalog); `POST /uploads/{video|poster}/url` (signed link into `uploads/`); `POST /repos/preview`;
  `POST /projects` (the "Render project" button: creates the published project);
  `GET /projects/by-slug/{slug}` and `GET /projects/by-slug/{slug}/video` (project page).
- The required fields are one list in the backend (`catalog.REQUIRED_FIELDS`), sent to the browser
  in the catalog. The upload page's section checks and "Ready to render" list use it, and Render
  re-checks it on the server, so the rule of what is required exists in one place.
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
| Category | Developer Tools | [D] |
| Post language | English | |
| Problem | Python developers have to learn JavaScript to build a web frontend. | [D] from README "no need to learn Javascript" |
| Outcome | Frontend and backend written in Python; the app runs at localhost:3000 with fast refresh. | [D] paraphrase of README |
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

0. Before push day: write the new Modal app file (the old `modal_app.py` was deleted with the old
   code), building its image from `backend/uv.lock`, and confirm Modal runs Python 3.13 [A].
No backup of the old database: Bek, 2026-11-23, the old tables and data are not needed (fresh
start).

1. Empty the R2 bucket `projecthouse-images` (all old images).
2. Drop every old table in Neon, including `alembic_version` (otherwise the new migrations collide
   with the old migration history); run the new migrations.
3. Deploy the new Modal app (the secret's setting names already match, checked 2026-11-23).
4. Update the Vercel environment variables (backend address; remove the old login flag). The
   Vercel project's root directory stays `frontend`.
5. Push to `main`; Vercel deploys the new frontend on the old link.
6. Check the R2 CORS rule includes the Vercel domain; check the live upload and project page.

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
- ~~Orphan videos (a draft abandoned after upload): not cleaned up yet.~~ Solved by D24: abandoned
  files sit only in `uploads/`, which the bucket lifecycle rule empties after 1 day. Rule
  `delete-temporary-uploads` (prefix `uploads/`, delete after 1 day) added by Bek in the Cloudflare
  dashboard, 2026-11-24 (confirmed by Bek; our token cannot read lifecycle settings).
- Rate limiting and abuse protection: not needed while only friends use the app (Bek, 2026-11-23).
