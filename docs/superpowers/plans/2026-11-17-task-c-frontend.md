# Task C: Frontend (feed, project page, login) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the approved mockups into the real website for what the backend already serves: the
feed, the project page and every login screen, in Uzbek, Russian and English, with no language
prefix in URLs.

**Architecture:** Next.js App Router with `cacheComponents: true` (already on). Server components
read data straight from FastAPI at `API_URL` and forward the visitor's cookie. Every state-changing
request (login, logout, signup, verify, reset) is a browser `fetch` to the same-origin `/api/...`
path, so the browser sends the `Origin` header the backend's CSRF check requires (a server-side
POST carries no Origin and gets 403 `bad_origin`). No server actions, no Next route handlers that
proxy POSTs.

**Tech Stack:** Next.js 16.4.6, React 19.3, next-intl 4.14.10, Tailwind 4.3.3, Vitest 4.1.12,
lucide-react (new, pinned in C1).

**Spec:** `docs/superpowers/specs/2026-11-17-project-house-design.md` (D17, D18, sections 8-9),
`docs/design/design-guide.md` (binding for every visual decision), `docs/design/tokens.css`,
`docs/design/2026-11-17-screens-mockup.html`, `docs/architecture.md` sections 1, 5, 6, 9.

**Split and order:** C1 (foundation, starting with a rendering spike) first. The orchestrator then
freezes the rendering pattern below from the spike's evidence. Then C2 (feed + project page) and
C3 (login screens) run in parallel, each in its own worktree from the reviewed C1 head, on disjoint
files.

**Plan review:** judged by a Fable reviewer on 2026-11-17 (APPROVE_WITH_CHANGES); every finding
is applied in this version.

## Global Constraints

- Read `frontend/AGENTS.md`: this Next.js has breaking changes; check `node_modules/next/dist/docs/`
  before using an API.
- **Rendering pattern (cacheComponents):** follow the section "Rendering pattern" exactly. Runtime
  data (`cookies()`, `headers()`, uncached `fetch`, `usePathname` in shared layouts) lives inside
  `<Suspense>` leaves with a fallback; never at the top of a layout.
- **Locale in every page:** each page and each `generateMetadata` awaits `params.locale`, checks it
  with `hasLocale`, then calls `setRequestLocale(locale)` (or `getTranslations({ locale, namespace })`).
  The layout's call does not cover pages.
- Colours, radii, fonts and type sizes come only from the design tokens; no raw hex in components.
  No shadows, no gradients, no emoji, no ALL CAPS labels; only measured text pairs from
  design-guide section 2.
- One font: Inter via `next/font/google`, weights 400/500/600/700, subsets `latin`, `latin-ext`,
  `cyrillic` (downloaded at build time; CI and Docker builds have network).
- Uzbek copy uses `ʻ` (U+02BB) in `oʻ gʻ` and `ʼ` (U+02BC), never the ASCII apostrophe.
- Icons: `lucide-react` only, 2 px stroke; icon-only buttons have an `aria-label`.
- **Images:** plain `<img loading="lazy" decoding="async">` (media comes from about 15 hosts, so
  `next/image` would need open `remotePatterns`), with one `eslint-disable-next-line
  @next/next/no-img-element` comment stating that reason, `alt = MediaItem.alt ?? project title`,
  and `onError` swapping to the neutral placeholder.
- **External links** (GitHub, live site, demo video, original author) go through `safeExternalUrl`
  and render with `target="_blank" rel="noopener noreferrer"`.
- **Accessibility (design-guide section 8, before any screen ships):** visible labels on every
  input; field errors linked with `aria-invalid` and `aria-describedby`; visible focus ring;
  touch targets >= 44 px on phone; `<video controls>`; iframes have `title`; hover/press motion
  disabled under `prefers-reduced-motion`.
- Show only features that work. No buttons or links for things the backend does not have yet
  (Message, Save, Like, Report, Add project, Messages, Search, profile pages).
- Desktop first (D18): desktop >= 1024 px, tablet 768-1023, phone < 768; every page works at 390 px.
- No new dependency except `lucide-react` (C1). Agent rules (`docs/agent-rules.md`) apply: TDD for
  logic, exact pins, small commits, no emoji, no overengineering.
- Gate before every commit: `npm run lint`, `npm test`, `npm run build` in `frontend/` (and the
  backend gate when backend files change).

## Rendering pattern (frozen by the orchestrator after C1 Step 1)

To be filled from the C1 spike evidence before C2/C3 are dispatched: which parts of a page sit in
Suspense leaves and with which fallbacks; the header's user slot and `LanguageSwitcher` each in
their own Suspense; how a missing project returns a real HTTP 404 (or, if that proves costly, a
recorded decision by Bek to accept a soft 404 with `noindex`).

## Review Focus

1. **Open redirect through `?next=`**: `//evil.com`, `https://evil.com`, `/\evil.com`,
   `javascript:...`, and a tab or newline after the first slash (`/%09/evil.com`, `/%0a/evil.com`;
   `new URL("/\t/evil.com", base)` resolves to `http://evil.com/` [V]) must all give `/`.
   Owner: C1 `safeNextPath` tests.
2. **Backend down, 5xx or missing project**: the visitor sees a short error message with a retry
   link, never a stack trace; a missing project gives the not-found page with the status decided
   in "Rendering pattern". Owner: C1 `apiGet` tests, C1 spike, orchestrator `curl -I` check.
3. **Messy project data**: 120-character titles, 3-line problems, 12 tech chips, no media, a cover
   that is a YouTube watch URL, an `.mp4`, a Loom or Vimeo link, or a broken image. Layout holds,
   nothing overflows at 390 px. Owner: C2 `coverImage`/`embedFor` tests and the visual check.
4. **Language without a URL prefix**: first visit with `Accept-Language: ru` gets Russian; a switch
   to Uzbek survives reload, navigation and a browser restart (cookie with `maxAge`), and keeps the
   query (`?field=`). Owner: orchestrator Playwright check (next-intl middleware cannot be imported
   under Vitest, `tests/proxy.test.ts`).
5. **Auth form failures**: each backend code shown next to its field (`email_taken`,
   `username_taken`, `invalid_username`, `weak_password`) or as a form message
   (`invalid_credentials`, `token_invalid`, `not_authenticated`); double submit and a network error
   do not break the form. Owner: C3 `authErrorField` tests; double submit and network error by the
   orchestrator Playwright check.

---

## Routes (all under `src/app/[locale]/`, URLs have no locale prefix)

| URL | Page | Data | Task |
|---|---|---|---|
| `/` | feed (`?field=`) | `GET /api/v1/projects?field=&limit=&cursor=` | C2 |
| `/demo/[slug]` | demo project page | `GET /api/v1/projects/demo/{slug}` | C2 |
| `/[username]/[slug]` | user project page | `GET /api/v1/users/{username}/projects/{slug}` | C2 |
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` | auth screens | `/api/v1/auth/*` | C3 |
| `/onboarding`, `/settings` | after first OAuth login / signup; connected providers | `/me`, `/providers` | C3 |

Static segments win over `[username]`. The backend reserves the new names (C1).

---

### Task C1: Foundation

**Files:**
- Modify: `backend/app/users/usernames.py` (add `forgot-password`, `reset-password`,
  `verify-email`, `onboarding`), `backend/tests/test_users.py`
- Modify: `backend/app/auth/router.py` (one route), create `backend/tests/test_auth_providers.py`
- Modify: `docs/architecture.md` (section 4 reserved list; section 6 the `/providers` endpoint)
- Modify: `frontend/src/i18n/routing.ts`, `frontend/src/i18n/request.ts`; create
  `frontend/src/i18n/navigation.ts`
- Replace: `frontend/messages/{uz,ru,en}.json` by `frontend/messages/{uz,ru,en}/common.json`, plus
  `projects.json` and `auth.json` containing `{}` (stubs C2 and C3 fill)
- Create: `frontend/src/app/tokens.css` (byte-identical copy of `docs/design/tokens.css`)
- Modify: `frontend/src/app/globals.css`, `frontend/src/app/[locale]/layout.tsx`,
  `frontend/src/app/[locale]/page.tsx` (becomes a minimal placeholder heading that C2 replaces)
- Delete: `frontend/src/components/BackendStatusLine.tsx`, `frontend/src/lib/backend.ts`,
  `frontend/tests/backend.test.ts`, the `Home`/`Status` message keys
- Create: `frontend/src/lib/{types,api,client-api,session,safe-url}.ts`,
  `frontend/src/components/{SiteHeader,LanguageSwitcher,LogoutButton}.tsx`
- Modify: `frontend/Dockerfile`, `docker-compose.yml`
- Tests: `frontend/tests/{routing,messages,api,safe-url,tokens}.test.ts`

**Interfaces (Produces):**
- `GET /api/v1/auth/providers` -> `{"providers": [...]}`, only providers whose client id AND secret
  are set, order `["google", "github"]`.
- `types.ts`: `Cover`, `MediaItem`, `Author`, `ProjectCard`, `ProjectDetail`, `FeedPage`, `Account`
  mirroring `backend/app/projects/schemas.py` and `AccountResponse` field for field;
  `type FieldName = "ai-apps" | "cv-ml" | "web" | "mobile" | "devtools" | "hardware" | "data"`;
  `const FIELD_NAMES: FieldName[]` in that order; `isFieldName(v: string): v is FieldName`.
- `api.ts` (server only): `type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number;
  code: string }`; `apiGet<T>(path: string, init?: { cookie?: string }): Promise<ApiResult<T>>`,
  base `process.env.API_URL ?? "http://localhost:8000"`, never throws: network error -> `{ ok:
  false, status: 0, code: "unreachable" }`; error body with our shape -> its code; anything else ->
  `"http_<status>"`. Caching per "Rendering pattern".
- `client-api.ts` (browser): `clientGet<T>(path)` and `clientPost<T>(path, body?)` on relative
  `/api/...` URLs, same `ApiResult<T>`, never throw; 204 -> `{ ok: true, data: null }`.
- `session.ts`: `getCurrentUser(): Promise<Account | null>` calls `/api/v1/auth/me` with the incoming
  `cookie` header; any non-200 -> `null`.
- `safe-url.ts`: `safeExternalUrl(url: string | null | undefined): string | null` (only `http:` /
  `https:` per `new URL`); `safeNextPath(next: string | null | undefined): string`: resolve
  `new URL(next, "http://x")`, require `origin === "http://x"` and `next` starting with `/`, return
  `pathname + search + hash`, else `"/"`.
- `routing.ts`: `localePrefix: "never"`, `localeCookie: { maxAge: 31536000 }`, default `uz`.
- `navigation.ts`: `export const { Link, redirect, usePathname, useRouter } = createNavigation(routing)`.
- `request.ts`: `export const NAMESPACES = ["common", "projects", "auth"]`; loads and merges
  `messages/<locale>/<ns>.json`. Nobody edits this list after C1.
- `common.json` namespaces: `Nav`, `Fields` (keys = `FieldName` values plus `all`), `Errors`
  (`unreachable`, `server`, `notFound`, `retry`).
- `LanguageSwitcher` keeps the current query string when switching.

- [ ] **Step 1: Rendering spike (first, before anything else).** On a throwaway branch commit (or a
  file deleted again before the next commit), build one dynamic page under `[locale]` that fetches
  `/api/v1/projects/demo/<slug>` and calls `notFound()` on 404, plus a layout slot that reads
  `cookies()`. Record `npm run build` output and `curl -I` status for an existing and a missing slug
  with `npm run start`. Try the variants the docs offer (Suspense leaves, `connection()`,
  `instant`/route config) and report which one gives a clean build AND a real 404. Report the
  evidence; do not continue with Step 2 until the orchestrator has frozen "Rendering pattern"
  (stop with status NEEDS_CONTEXT and the evidence).
- [ ] **Step 2: Backend.** Tests first: `create_user` rejects each of the four new reserved names
  (422 `invalid_username`); `/providers` returns `[]` without credentials, `["github"]` with only
  GitHub id+secret, never a provider with only one of the two. Implement, update the architecture
  doc, backend gate, commit.
- [ ] **Step 3: Routing and messages.** Tests first: routing values above (including the cookie
  `maxAge`); the messages test walks every namespace file and checks uz/ru/en key parity and
  non-empty strings (empty `{}` files allowed). Implement, write `Nav`/`Fields`/`Errors` copy in all
  three languages (Uzbek field names from the mockup: AI ilovalar, Kompyuter koʻrishi, Veb, Mobil,
  Dasturchilar uchun, Apparat, Maʼlumotlar, Hammasi), delete the old home status code, commit.
- [ ] **Step 4: Data and safety helpers.** Tests first: `apiGet` with a mocked `fetch` (200 JSON,
  404 error shape -> `project_not_found`, 500 HTML -> `http_500`, thrown error -> `unreachable`,
  cookie forwarded); `safeExternalUrl` (http/https kept; `javascript:`, `data:`, `ftp:`, relative,
  garbage rejected); `safeNextPath` (every Review Focus 1 case, including raw tab/newline and
  `%09`/`%0a` after `URLSearchParams` decoding, gives `/`; `/settings` and `/demo/x?y=1#z` kept).
  Implement, commit.
- [ ] **Step 5: Look and frame.** Test: `src/app/tokens.css` equals `docs/design/tokens.css` byte for
  byte. Implement `globals.css` (imports `tokens.css`, drops the Geist/dark defaults), Inter in the
  layout, `SiteHeader` per the rendering pattern: logo text "Project House", "Lenta" link,
  `LanguageSwitcher` (client, `useRouter().replace({ pathname, query }, { locale })`), and a user
  slot showing Kirish / Roʻyxatdan oʻtish links or the display name, a "Sozlamalar" link and
  `LogoutButton` (client: `clientPost("/api/v1/auth/logout")`, then `router.refresh()`). Side padding
  40/24/16, max width 1280. Install `lucide-react` pinned exactly. Commit.
- [ ] **Step 6: Docker build arg.** `frontend/Dockerfile` build stage: `ARG API_URL=http://backend:8000`
  and `ENV API_URL=$API_URL` before `npm run build`; `docker-compose.yml` frontend
  `build: { context: ./frontend, args: { API_URL: http://backend:8000 } }`. Verify with
  `docker compose up -d --build backend frontend` and `curl -s localhost:3000/api/health` (expect
  the backend's JSON), then `docker compose stop frontend backend`. Commit.

### Task C2: Feed and project page (parallel with C3, after C1)

**Files:**
- Fill: `frontend/messages/{uz,ru,en}/projects.json`
- Replace: `frontend/src/app/[locale]/page.tsx` (feed)
- Create: `frontend/src/app/[locale]/demo/[slug]/page.tsx`, `[username]/[slug]/page.tsx`,
  `not-found.tsx`, `error.tsx`
- Create: `frontend/src/components/projects/{ProjectCard,FieldFilters,LoadMore,ProjectView,MediaPlayer}.tsx`
- Create: `frontend/src/lib/{media,format,projects}.ts`
- Tests: `frontend/tests/{media,format}.test.ts`

**Interfaces:**
- Consumes: C1 `apiGet`, `clientGet`, types, `isFieldName`, `safeExternalUrl`, `Link`, `Fields` and
  `Errors` messages, the rendering pattern.
- `media.ts`: `youtubeId(url: string): string | null` (watch?v=, youtu.be/, /embed/, /shorts/);
  `coverImage(cover: Cover | null): { src: string | null; isVideo: boolean }` (YouTube ->
  `https://i.ytimg.com/vi/<id>/hqdefault.jpg`; other video -> `src: null, isVideo: true`; image ->
  its url); `embedFor(media: MediaItem): { kind: "iframe"; src: string } | { kind: "video"; src:
  string } | { kind: "image"; src: string } | { kind: "link"; src: string }` (YouTube ->
  `https://www.youtube-nocookie.com/embed/<id>`; Loom share URL -> `https://www.loom.com/embed/<id>`;
  Vimeo -> `https://player.vimeo.com/video/<id>`; `.mp4` -> video; image kind -> image; anything
  else -> link).
- `format.ts`: `formatDate(iso: string, locale: string): string` via `Intl.DateTimeFormat`
  (`day: "numeric", month: "long", year: "numeric"`).
- `projects.ts` (server): `getDemoProject(slug)` and `getUserProject(username, slug)` wrapped in
  React `cache()` so `generateMetadata` and the page share one request.

- [ ] **Step 1: Media and format helpers.** Tests first with the real seed's URL shapes (YouTube
  watch, youtu.be, `.mp4`, `.gif` image) plus Loom, Vimeo and garbage. Implement. Commit.
- [ ] **Step 2: Feed `/`.** Fetch `?limit=24` plus `field` when `isFieldName(field)` (an unknown value
  renders the "all" view). Heading "Yangi loyihalar" and sub line from the mockup; `FieldFilters` =
  pill links (`/` and `/?field=<f>`), active pill `primary`; grid 4/2/1 columns, gap 20; card links
  use `card.path` from the API. `ProjectCard` per design-guide section 6: 16:9 cover via
  `coverImage`, play icon when `isVideo`, placeholder when `src` is null or the image fails, title
  16/600 clamped to 2 lines, problem 14 `mute` clamped to 2, max 3 chips, divider, author name as
  text; demo cards show a small "Namuna" badge; no like counts. `LoadMore` (client) props
  `{ initialCursor: string | null; field: FieldName | null }`, sends `field` with every `cursor`
  request, appends, hides when `next_cursor` is null, shows the retry message on failure. Empty state
  copy from design-guide section 10 without the add button. API failure -> `Errors` message + retry
  link. Commit.
- [ ] **Step 3: Project page.** `demo/[slug]` and `[username]/[slug]` share `ProjectView`; missing
  project -> not-found per the rendering pattern; other failure -> error message. Layout per
  design-guide sections 4/6: desktop demo column 768 + evaluation panel; tablet panel below; phone
  stacked. `MediaPlayer` renders the first media via `embedFor` (iframe with `title`, `allow=
  "encrypted-media; picture-in-picture"`, `allowFullScreen`, `loading="lazy"`; `<video controls>`),
  remaining images as a strip. Panel: title (h1), one-line problem (lead), Result block only when
  `result` is set, all tech chips, key-value list (Yoʻnalish, Roli, Litsenziya, Joylandi =
  `formatDate`), author row (demo: "Asl muallif: <name>" as an external link to `author.url`; user:
  the display name as plain text until profile pages exist), links row: GitHub, Sinab koʻrish
  (`live_url`), Demo video, Ulashish (client, copies `location.href`, shows "Nusxalandi"). Short
  description below (body). Demo projects show a notice that this is a sample project by its
  original author. `generateMetadata`: title, `description` = one-line problem, `openGraph`
  title/description. Commit.
- [ ] **Step 4: not-found and error pages** in the design language with a link back to the feed.
  Commit.

### Task C3: Login screens (parallel with C2, after C1)

**Files:**
- Fill: `frontend/messages/{uz,ru,en}/auth.json`
- Create pages: `login`, `signup`, `forgot-password`, `reset-password`, `verify-email`,
  `onboarding`, `settings` under `src/app/[locale]/`
- Create: `frontend/src/components/auth/{AuthCard,TextField,ProviderButtons,LoginForm,SignupForm,ForgotForm,ResetForm,VerifyEmail}.tsx`
- Create: `frontend/src/lib/auth-errors.ts`
- Tests: `frontend/tests/auth-errors.test.ts`

**Interfaces:**
- Consumes: C1 `clientPost`, `apiGet`, `getCurrentUser`, `safeNextPath`, `Link`, `useRouter`,
  `redirect`, `GET /api/v1/auth/providers`, the rendering pattern.
- `auth-errors.ts`: `authErrorField(code: string): "email" | "password" | "username" | "form"`
  (`email_taken` -> email; `username_taken`, `invalid_username` -> username; `weak_password` ->
  password; everything else -> form) and `authErrorKey(code: string): string` (message key; unknown
  codes -> `"generic"`). The redirect codes `account_exists`, `oauth_failed`, `provider_in_use`,
  `provider_already_connected`, `verify_email_first` each have their own key.
- `TextField` props include `error?: string`; it sets `aria-invalid` and `aria-describedby` to the
  error element's id.

- [ ] **Step 1: Error mapping.** Tests first for every code above and an unknown code. Implement.
  Commit.
- [ ] **Step 2: Login and signup.** `/login`: email + password form, provider buttons only for
  providers from `/providers` (plain `<a href="/api/v1/auth/oauth/<p>/start">`), links to
  forgot-password and signup, banner for `?error=` (for `account_exists` with the provider name:
  "Bu email bilan hisob bor. Avval kiring, keyin <provider>ni ulang."). Success ->
  `router.replace(safeNextPath(next))` + `router.refresh()`. Already logged in -> next-intl
  `redirect({ href: "/", locale })`. Known limitation, shown nowhere and recorded as DEFERRED: the
  OAuth buttons do not carry `next` (the backend callback always lands on `/` or `/onboarding`).
  `/signup`: email, password (hint: at least 10 characters), username (hint: 3-30 of a-z, 0-9, `_`,
  `-`), display name, account type (Dasturchi / Kompaniya radio); field errors via `authErrorField`;
  on 201 -> `/onboarding?verify=1`. Submit buttons disable while a request is in flight. Commit.
- [ ] **Step 3: Token pages.** Both set `metadata.referrer = "no-referrer"`. `/reset-password`:
  read `token`, remove it from the address bar with `history.replaceState`, new-password form;
  204 -> success + link to login; `token_invalid` -> message + link to forgot-password.
  `/forgot-password`: email; always the same "if the account exists we sent a link" message.
  `/verify-email`: read `token`, strip it from the URL, keep it in `sessionStorage` under
  `ph_verify_token`, POST; 204 -> success; 401 -> `/login?next=/verify-email` (the page retries from
  `sessionStorage` after login); 400 -> "link expired or for another account, log into the right
  account". Clear the stored token after 204 or 400. Commit.
- [ ] **Step 4: Onboarding and settings.** `/onboarding`: welcome text, with `?verify=1` an extra
  line asking to confirm the email; links to the feed and settings. `/settings`: not logged in ->
  `redirect` to `/login?next=/settings`; shows email with verified (green `ok`) or unverified (blue
  info) badge, connected providers, and "Ulash" links for enabled providers not yet connected
  (`/api/v1/auth/oauth/<p>/start`); banner for `?error=provider_in_use|provider_already_connected|
  verify_email_first`. Commit.

---

## Out of scope (no backend yet; each arrives with its own task)

Profile pages (`/<username>`), add project, likes, saves, comments, messages and requests, search,
explore, admin, the phone bottom tab bar (it would only hold one working item), the generated
1200x630 share image, dark theme, resend-verification, carrying `next` through OAuth.

## Orchestrator checks after each branch (not agent steps)

- Re-run `npm run lint`, `npm test`, `npm run build` (and the backend gate for C1).
- `curl -I` on an existing and a missing project (status per "Rendering pattern").
- Playwright against a backend with the demo seed: desktop 1440, tablet 768, phone 390 screenshots
  of the feed and a project page compared with the mockups; Review Focus 4 (Accept-Language ru,
  switch survives reload and restart, query kept) and 5 (double submit, offline submit); login,
  signup, verify and logout flows through `localhost:3000`.
- One Opus review per branch (spec, quality, overengineering; security focus on C3).
