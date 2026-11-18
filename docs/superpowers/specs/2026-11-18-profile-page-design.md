# Profile page - Design

Date: 2026-11-18. Spec step 1 remainder (`2026-11-17-project-house-design.md` section 9 item 2,
section 10 "Developer profile fields", D14, D17). Add project (step 2) follows this.

## Intent

Anyone who opens `<domain>/<username>` sees who the person is and **all their projects as a grid**,
the way an Instagram page shows a person's posts (Bek). Companies browse these pages to find
developers. The owner can fill in their profile; today nothing can set any profile field beyond
name, username and account type.

## Goals

- Public profile page `/<username>` for developer and company accounts, matching mockup screens
  3 and 3b (`docs/design/2026-11-17-screens-mockup.html`, desktop first, tablet second, phone
  "does not break").
- The owner's projects on that page, newest first, as feed cards, with "load more".
- An edit-profile form for the logged-in owner.
- The 29 sample projects appear as posted by Bek's own account (see "Sample projects").

## Non-goals (each comes later with its own step)

Profile photo upload (decided with Add project, which needs the same image storage), username
change, account-type change, the Message button (DMs, step 5), like count (likes, step 4), follow
(not in Phase 1), Open Graph preview image (step 3), company verification UI (admin, step 6).

## Anti-goals

- Never show email, phone or Telegram on a profile (spec section 10).
- No placeholder or "claim profile" accounts (D16).

## Approaches considered

| | Approach | Trade-off | Picked |
|---|---|---|---|
| A | Profile page + edit form + projects endpoint, initials instead of photo | Complete and useful now; photo waits for step 2 | **Yes (Bek, 2026-11-18)** |
| B | Profile page only, no edit form | Every profile would show only a name | no |
| C | A plus photo upload now | Image storage would be chosen twice (Add project needs it for 6 images per project) | no |

Sample projects - options put to Bek: an official "Project House" account, Bek's account marked
"shared", or keep them ownerless. **Bek chose: posted from his own account, looking like his own
work, as temporary development data that he deletes when development is done.** This replaces the
"no user accounts for demo rows (Bek, option 1)" rule in `docs/architecture.md` section 7.

## Design

### Backend

1. **Migration 0004:** `users.about text NULL`.
2. **`GET /api/v1/users/{username}`** (exists) also returns `about` and `project_count` (count of
   that user's projects).
3. **`GET /api/v1/users/{username}/projects?limit&cursor`**: that user's projects as feed cards,
   newest first, same cursor and card shape as `GET /api/v1/projects`, 404 `user_not_found` for an
   unknown username. Reuse the feed query with an owner filter.
4. **Edit own profile:** `PATCH /api/v1/auth/me` (same path as `GET /auth/me`, returns the same
   account response). Requires the session; covered by the existing Origin check (PATCH is in
   `UNSAFE_METHODS`). Accepts any subset of:

   | Field | Who | Rule (Claude's call, Bek can override) |
   |---|---|---|
   | `display_name` | both | trimmed, 1-60 chars, not blank |
   | `headline` | both | 0-120 chars (company: their role, e.g. "HR manager") |
   | `location` | both | 0-80 |
   | `university_or_employer` | developer | 0-120 |
   | `company_name` | company | 0-80 |
   | `open_to_work` | developer | bool |
   | `about` | both | 0-1000 |
   | `links.github` | developer | empty or `https://github.com/<name>` |
   | `links.linkedin` | developer | empty or `https://linkedin.com/...` or `https://www.linkedin.com/...` |
   | `links.website` | both | empty or any `https://` URL, max 200 |

   Empty string clears a field (stored as NULL, or the key removed from `links`). A field that does
   not belong to the account type gets 422. `username`, `account_type`, `is_verified_company`,
   `avatar_url` are not editable here. Errors use the existing `{"error":{code,message}}` shape.

### Sample projects

- `python -m app.projects.seed_demo --owner <username>` sets `owner_id` of every sample to that
  existing account. Without `--owner` it behaves as today (ownerless), so existing tests and the
  test databases keep working. Unknown username: exit 2, nothing written.
- Samples stay `is_demo = true` (the loader finds them by slug for its upsert). The production
  refusal stays.
- **Remove the loader's `--delete` option** and its tests (Bek: not needed). Bek deletes the samples
  with the project delete button, which arrives with Add project (step 2).
- Who is shown is decided by **ownership, not by `is_demo`**: a row with an owner gets
  `author.kind = "user"`, the owner's name, and path `/<username>/<slug>`; only ownerless rows keep
  the demo author and `/demo/<slug>`. Frontend: the "Sample" badge and the demo notes on the
  project page show only for `author.kind === "demo"` (today `ProjectView.tsx` uses `is_demo`).
- Slugs: owned samples fall under the existing unique `(owner_id, slug)` index. Add project (step 2)
  must handle a slug that is already taken by a sample.
- Bek signs up locally with the username he wants; the loader is then run with that username.

### Frontend

- **`/[username]`** (folder exists for `[slug]`): server component, `notFound()` for 404, rendering
  pattern as in the Task C plan (variant G).
  - Side card (desktop) / header card (tablet, phone) per mockup: initials avatar, name, headline,
    badge "Open to work" (developer with `open_to_work`) or "Verified company" (company with
    `is_verified_company`), facts (location, university or employer, company name, links), stats
    (project count only), actions: **Share** (existing `ShareButton`) and, on your own page,
    **Edit profile**; the privacy line for developers.
  - Developer: tabs "Projects (N)" and "About"; the About tab is shown only when `about` is set.
    Company: the About panel, then their projects if any.
  - Projects grid: `ProjectCard`, 3 columns desktop, 2 tablet, 1 phone, "load more" as on the feed.
    Empty: "No projects yet."
  - Tab title `Name (@username) - Project House`.
- **`/settings/profile`**: the edit form (no mockup yet: drawn first in the approved design system,
  advisor-gated, then built). Fields per account type as in the table; save shows a success banner;
  field errors next to the field. Linked from the profile ("Edit profile") and from `/settings`.
- **Header:** the logged-in user's name links to their profile.
- Texts in uz / ru / en.

## Calls made after the builder check (Claude's, Bek can override)

- **Field errors:** the 422 handler folds pydantic failures into one `validation_error` code
  (`backend/app/core/errors.py:73-79`), and the form maps errors by code. So the PATCH service
  checks the rules itself and raises one `AppError` code per field (for example `invalid_headline`,
  `invalid_github_link`); the form maps each code to its input. Inputs carry `maxLength`, so in
  practice only link format can fail, one field per response. The error shape is unchanged.
- **`project_count`** is returned only by `GET /users/{username}` (a profile response that extends
  `UserPublic`), not by `/auth/me`.
- **Owned samples** answer only at `/<username>/<slug>`: `/demo/<slug>` looks up ownerless sample
  rows only (404 otherwise).
- **Loader without `--owner`** leaves an existing row's owner as it is; it never writes `NULL` over
  Bek's ownership.
- **Company profile:** no stats row (mockup 3b has none).
- **Phone header:** the name stays hidden on phone (accepted 2026-11-17); the profile is reached
  from `/settings` there. A phone link to the profile is added with the phone header work later.

## Left to the builder

Component split, the exact cursor reuse, the message keys, the PATCH client helper, and how the
form tracks dirty state.
