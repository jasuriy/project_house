# Project House - Design (Phase 1)

Date: 2026-11-17
Status: DRAFT - waiting for Bek's final approval
Research behind this doc: `docs/research/2026-11-17-market-recon.md`
Evidence tags: [V] verified, [C] claim from a third-party source, [A] assumption, [U] unknown.

---

## 1. What we are building, in one paragraph

Project House is "Instagram where every post is a project". A developer (student or engineer)
makes a profile and adds projects. Adding a project starts from a GitHub link: we auto-fill the
details with AI, the developer adds a demo video link and images, and the project appears as a
clean, fixed-format card that is easy to judge in under a minute. Projects show up in a feed.
People like, comment, save and share them. Companies (HR, recruiters, CTOs, CEOs) browse projects
and, when they are impressed, send the developer a direct message to discuss an offer.

## 2. Why

- On Instagram, students and engineers who post their work are buried in entertainment content.
- A GitHub repo or a CV line is a weak signal. A company cannot quickly see what someone built.
- Project House gives real work its own place, in a format that keeps out the junk: a meme does
  not fit a project card.

## 3. Who it is for

| Account type | Who | What they do |
|---|---|---|
| Developer | Students, early-career and working engineers | Create profile, add projects, like/comment/save, DM others |
| Company | **One person** (HR, recruiter, CTO, CEO) who states which company they represent | Browse feed and profiles, like/comment/save, DM developers |

A company account is a personal account in Phase 1 (e.g. "Dilnoza, HR at EPAM"). Organisation
pages with several members sharing one inbox are a later phase.

Starting market: Uzbekistan. Interface languages: **Uzbek, Russian, English**.

## 4. Goals, non-goals, anti-goals

**Goals (Phase 1)**
- A developer can go from GitHub link to a published project page in about 10 minutes.
- A project page looks good on a phone and shows a good preview card when shared in Telegram.
- A company can find a project and start a conversation with its author.

**Non-goals (not in Phase 1)**
- Recommendation algorithm. The feed is newest-first plus a filter by field.
- Follows, a mobile app, group chats, voice/file messages in DMs, "typing..." indicator.
- Organisation company pages (several people per company).
- Telegram login.
- Reviewer scores and badges (Phase 2). Company search tools, weekly top list (Phase 3).
- Hosting source code or video files.
- Many visual templates. Phase 1 has one look.

**Anti-goals (failure even if it works)**
- The feed drifts into entertainment or memes.
- Students receive spam or scam "job offers".
- People publish projects they did not build.
- Developers find adding a project tedious and stop after one.

## 5. Decisions made by Bek

| # | Decision |
|---|---|
| D1 | Every project uses the **same fixed fields** in the same layout. Only the visual style may change, and Phase 1 has one style. |
| D2 | The **hosted link** is the main output (e.g. `<domain>/<username>/<project>`). HTML export, if ever built, is secondary. |
| D3 | **Do not host code or video.** Code = GitHub link/import. Video = YouTube or Loom embed. Images are uploaded. |
| D4 | **GitHub auto-fill:** paste a repo link, AI fills name, tech stack and description from the README. User edits and adds the rest. |
| D5 | **Telegram-friendly preview** (Open Graph image, title, one-line problem) on every project page. |
| D6 | **Two account types:** developer and company. |
| D7 | **Phase 1 feed:** newest first, filter by field. Likes, saves, comments included. |
| D8 | **No "send offer" button.** Offers happen in **DMs**, like Instagram. |
| D9 | **DM message requests:** anyone can write to anyone; a first message from a stranger lands in "Requests" and the receiver accepts or ignores it. |
| D10 | **Interface languages:** Uzbek, Russian, English. Project content stays in whatever language the author writes. AI auto-fill writes in the language the author picks on the import form (default: current interface language). |
| D11 | **First users:** Bek promotes the platform to developers and companies personally. |
| D12 | **Phases:** 1 = pages + feed + DMs; 2 = reviews and badges; 3 = company search, weekly top projects, more social features. |
| D13 | **Stack: B** - Next.js frontend + FastAPI (Python) backend + PostgreSQL, on our own server. |
| D14 | **Company account = one person** in Phase 1. |
| D15 | **Login for everyone: Google, email, or GitHub.** |
| D16 | **Seed content:** Bek's ~30 friends sign up and add their own projects. No placeholder or "claim profile" feature. |
| D17 | **No language in URLs** (next-intl `localePrefix: 'never'`, decided 2026-11-17). One link per page, e.g. `<domain>/<username>/<project>`. Interface language comes from the visitor's saved choice (cookie) or browser, with a language switcher. Usernames and project slugs may not contain dots and may not equal `uz`, `ru`, `en` or start with reserved prefixes (`api`, `_next`, `_vercel`). Implemented at the start of Step 1. |
| D18 | **Desktop-first website** (Bek, 2026-11-17). Project House is mainly a website, not a mobile app. Screens are designed for desktop first, then tablet; the phone layout is designed last (it must still work, since shared links open on phones). |

## 6. Approaches considered

| | A. Next.js + Supabase | **B. Next.js + FastAPI + own server (CHOSEN)** | C. Django monolith |
|---|---|---|---|
| Summary | Supabase gives DB, login, storage, realtime | Own Python API, own server | One Python app, server-rendered |
| Build speed | Fastest | Slower: login, uploads, realtime, deploy built by us | Medium |
| Data in Uzbekistan | Not by default | Yes, if the server is in Uzbekistan | Yes |
| CI/CD | Mostly automatic (Vercel) | GitHub Actions + Docker, we maintain it | Same as B |

**Why B (Bek's choice):** full control, Python backend, and the server can sit in Uzbekistan.
**Cost of B, stated honestly:** login, image storage, realtime DMs, deployment, backups and server
maintenance are ours to build and run. Step 0 and step 5 are larger than with A [A: estimate].

## 7. Technical shape (stack B)

| Part | Choice |
|---|---|
| Frontend | Next.js (React). Server-side rendering for project and profile pages, so link previews and search engines see full content. |
| Backend | FastAPI (Python). REST API + WebSocket endpoint for DMs. |
| Database | PostgreSQL. Schema changes through Alembic migrations. |
| Images | Stored outside the database (object storage or server disk), resized on upload. Must be included in backups. |
| Realtime DMs | FastAPI WebSockets. Phase 1 runs one backend instance, so in-memory connection tracking is enough. If we ever run 2+ instances, add Redis pub/sub [D: messages must reach a socket held by another instance]. |
| Login | Google OAuth, GitHub OAuth, email + password (with email verification and password reset). **Use a maintained auth library; never hand-write password hashing or OAuth flows.** |
| AI auto-fill | Backend calls an AI model API with the README + GitHub language stats. |
| Notifications | Telegram bot (user links their Telegram) + email fallback. |
| Hosting | One server running Docker Compose (frontend, backend, Postgres, reverse proxy with HTTPS). |
| Backups | Daily database + image backup to a **different** location than the server. Restore tested once before launch. |

**CI/CD (GitHub Actions, repo `jasuriy/project_house`)**
- On every pull request: lint + tests for frontend and backend.
- On merge to `main`: build Docker images, push to a container registry, deploy to the server,
  run database migrations.
- Secrets (API keys, OAuth secrets, DB password) live in GitHub Secrets and the server's
  environment, never in the repo.

**Legal [U]:** Uzbekistan's personal-data law was amended in March 2026; biometric, genetic and
telecom data must stay in the country, other data may go abroad under listed conditions [C].
Hosting the server in Uzbekistan settles where **our** database and images are stored. It does
not settle the foreign services that still receive personal data: Google and GitHub login (names,
emails), the email-sending service, the Telegram bot (who messaged whom, message previews), and
possibly the AI API (only if personal data is sent to it). The law also covers processing abroad,
not only storage. So the check of amended Article 27-1 on lex.uz, or a lawyer, is still needed
**before public launch (step 7)**. It does not block building.

## 8. The project card (fixed fields)

| Field | Source | Required |
|---|---|---|
| Title | Auto-fill from GitHub, editable | yes |
| One-line problem ("what problem does it solve") | Author | yes |
| Short description (what it does, how) | Auto-fill from README, editable | yes |
| Result (preferably with a number) | Author | no |
| Demo video | YouTube / Loom link, embedded | video or at least one image required |
| Images | Uploaded, max 6 | see above |
| Tech stack (tags) | Auto-fill from GitHub languages + README, editable | yes |
| Field / category (CV, web, mobile, hardware, data, ...) | Author picks from a fixed list | yes |
| GitHub repo link | Author | no (hardware / research projects may have none) |
| License | Read from GitHub if present; "not specified" otherwise | auto |
| Author's role (e.g. "built backend and model") | Author | no |

## 9. Main screens

1. Sign up / log in (Google, email, GitHub; pick developer or company), language switch.
2. Profile page (developer: details + projects grid; company: person, company name, about, website).
3. Add project: paste GitHub link -> auto-filled form -> add demo + images -> publish.
4. Project page (public, no login needed to view; login needed to like/comment/save/DM).
5. Feed (newest first, filter by field).
6. Saved projects.
7. Messages: Inbox + Requests.
8. Settings: language, linked GitHub, linked Telegram, DM request filter.
9. Minimal admin: remove a project/comment/user, review reports, mark a company "verified".

## 10. Calls made by Claude (Bek can override)

- Project and profile pages are **public**; actions need login.
- Phase 1 is a **mobile-friendly website**, not an app.
- **Repo ownership check:** importing a GitHub repo requires a linked GitHub account (one click,
  "Connect GitHub", for users who logged in with Google or email). The import is allowed only if
  that GitHub account owns or contributed to the repo.
- **Report button** on projects, comments and messages, plus a minimal admin screen.
- **Company accounts are not verified automatically**; Bek can mark a company "verified" (badge).
- **Anti-spam in DMs:** a new account can send only a limited number of first messages per day;
  the number is set after watching real usage. Developers get a setting "only accept requests
  from verified companies" (off by default).
- **Projects go live immediately**; bad content is handled through reports + admin removal.
- **Developer profile fields:** photo, name, headline, location, university or employer,
  "open to work" toggle, links (GitHub, LinkedIn, personal site). Email, phone and Telegram are
  never shown publicly; contact happens through DMs.
- One owner per project; co-authors later. Max 6 images per project.
- Email login uses email + password with verification and reset.

## 11. Development steps (Phase 1)

Each step ends with something that works and can be shown. A detailed task plan follows after
this doc is approved.

| Step | What | Done when |
|---|---|---|
| 0 | Setup: repo, Next.js + FastAPI + Postgres in Docker Compose, CI (lint + tests), CD (deploy on merge), 3-language skeleton, server with HTTPS, backups | A "hello" page in 3 languages deploys automatically on merge; a backup runs and restores |
| 1 | Accounts: sign up / log in with Google, email, GitHub; developer or company; profile pages | Test accounts of both types exist via each login method |
| 2 | Add project: Connect GitHub, ownership check, AI auto-fill, edit form, demo embed, images | A real repo becomes a published project in ~10 minutes; someone else's repo is rejected |
| 3 | Project page + Telegram / Open Graph preview | Link pasted in Telegram shows a good preview card |
| 4 | Feed + filter by field + likes, saves, comments + report button | Logged-in user can browse, like, save, comment, report |
| 5 | DMs with Requests, WebSockets, Telegram/email alerts, anti-spam limit | Company DMs a developer, it lands in Requests, developer accepts and replies live, alert arrives in Telegram |
| 6 | Minimal admin + private beta: Bek's ~30 friends sign up and add projects; first HR/CTO accounts invited | Feed has real projects from real owners; issues from the beta are fixed |
| 7 | Hosting/legal check, then public launch | Server location decided and data question answered; site open to public |

## 12. Left to the builder

- Folder structure, UI component library, styling approach.
- Which auth library, AI model API, container registry, image storage method.
- Database schema details and test strategy.
- Server provider (Bek to confirm; an Uzbek provider settles where our own data is stored, but
  not the foreign services listed in section 7).
- Domain name (Bek to buy; `projecthouse.uz` used only as an example).

## 13. Open questions

- Server provider and location. **Blocks step 0 deploy part only**; local development can start
  without it.
- Legal check of data storage and transfers to foreign services (section 7). **Blocks step 7 only.**
