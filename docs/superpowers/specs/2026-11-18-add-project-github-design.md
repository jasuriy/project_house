# Add project, part 2: GitHub import and the ownership check - Design

Date: 2026-11-18. Spec step 2 (`2026-11-17-project-house-design.md` D4, section 8 "Licence: read from
GitHub", section 10 "Repo ownership check"). Part 1 (manual add/edit/delete) is merged (#10).

## Intent

A developer pastes their repository link and the form fills itself from GitHub; a repository that is
not theirs is refused. Companies browsing a project can trust that its GitHub link belongs to its
author.

## Bek's decisions (2026-11-18)

- Auto-fill from GitHub's own data now; the AI README summary later (needs an AI key).
- **Every GitHub link on a project passes the ownership check when it is saved**, whether it came
  from the import or was typed into the form. Projects without a GitHub link need nothing.
- A local GitHub OAuth App is registered (credentials in the git-ignored root `.env`).

## Goals

- `/new` starts with step 1: paste a GitHub link, Continue; or "fill in by hand without GitHub".
- Step 2 is the existing form, pre-filled: name, description, tech stack (languages), live site
  (repo homepage), GitHub link (canonical), licence (read-only), with a "from GitHub" mark on filled
  fields and a green banner that says whose repository it is.
- Saving any project with a GitHub link verifies ownership and stores the licence read from GitHub.
- After connecting GitHub (or Google) from Settings, the user lands back on Settings with a green
  "connected" banner (today: the feed, no message).

## Non-goals (later)

AI summary and the "which language should the AI write in" field; private repositories; images or
video taken from the README; a server-side GitHub token (needed before launch: see constraints).

## Anti-goals

- Never accept a repository as someone's because they typed its link.
- Never store or use the user's GitHub OAuth token (the login reads the profile once and drops it).

## Ownership rule (Claude's calls, Bek can override)

- The user must have a connected GitHub account (`auth_identities` row, provider `github`;
  `provider_user_id` is GitHub's permanent numeric user id). Without one: `github_not_connected`.
- **Owner:** the repository's `owner.id` equals that id, and the repository is not a fork.
- **Contributor:** that id is in the repository's contributors (first 100 by commits). This also
  covers organisation repositories and forks with your own commits.
- A fork you merely copied (no commits of yours) is refused: forking Apache Superset does not make it
  yours.
- Private or missing repositories answer 404 to an unauthenticated read: `github_repo_not_found`.
- GitHub down, slow (10 s) or rate-limited: `github_unavailable` (the user can retry or save without
  the link).

## Approaches considered

| | Approach | Trade-off | Picked |
|---|---|---|---|
| A | Check on every save that sets or changes a GitHub link; the import only previews | One rule for both paths; a save makes 2-3 GitHub calls | **yes** |
| B | The import issues a signed token proving the check; save accepts the token | Fewer GitHub calls, but a token format, expiry and a second path to keep honest | no |
| C | Check only on import (manual links unchecked) | Anyone can claim any repo by typing it | no (Bek) |

## Design

### Backend

1. `app/projects/github.py`: a small GitHub client (httpx, 10 s timeout, a `User-Agent`, optional
   `GITHUB_API_TOKEN` setting sent as a bearer token when set). Reads: `GET /repos/{o}/{r}`,
   `GET /repos/{o}/{r}/languages`, `GET /repos/{o}/{r}/contributors?per_page=100`. Injected as a
   FastAPI dependency so tests use a fake (no network in tests).
2. `POST /api/v1/me/projects/import` `{github_url}` (developers, Origin check): parses the link,
   checks ownership, returns the pre-fill `{title, short_description, tech_stack, live_url,
   github_url, license, relation: "owner" | "contributor", github_login}`. Creates nothing.
   - title: the repository name as written; short_description: the repository description (may be
     empty); tech_stack: up to 5 languages by size; live_url: the repo homepage if http(s);
     github_url: the canonical `html_url`; license: the SPDX name, or null.
3. Create and edit: when `github_url` is set or changed to a non-empty link, run the same check and
   store the canonical link and the licence; clearing the link clears the licence. Same error codes,
   reported on the `github_url` field: `github_not_connected`, `not_your_repo`,
   `github_repo_not_found`, `github_unavailable` (503).
4. OAuth callback: the `connected` outcome redirects to `/settings?connected=<provider>`.

### Frontend

- `/new` step 1 (new drawing, then built): the link field and Continue; when GitHub is not connected,
  a box explaining it with a button to Settings; a "fill in by hand without GitHub" link to step 2.
- Step 2: the existing `ProjectForm` with the pre-fill, the green banner ("GitHub connected:
  <login>. You own this repository" / "...you contributed to it"), a "from GitHub" badge on filled
  fields (mockup's "AI to'ldirdi" badge, worded for GitHub), and the licence row read-only
  (mockup screen 4 "Litsenziya ... (GitHub'dan olindi)").
- Settings: green banner on `?connected=github|google`.
- uz / ru / en texts.

### Constraints

- GitHub allows 60 unauthenticated API calls per hour per server address: enough locally and for a
  few testers; before launch set `GITHUB_API_TOKEN` (5000 per hour). DEFERRED to deploy.
- No new dependencies (httpx is already used).

## Calls made after the builder check (Claude's, Bek can override)

- **What the check proves:** that the user controls the repository (owner) or has commits in it
  (contributor), not that they wrote the code. Copying someone's code into a new repository of your
  own passes as "owner"; forking a small repository and adding one commit passes as "contributor"
  (a fork carries the original history). No GitHub API check can close this; reports and admin
  removal (spec section 10) are the backstop. Told to Bek.
- **"Changed" link:** a save re-runs the check when the sent `github_url`, made canonical, differs
  from the stored one. Links saved before this change are not back-filled: there are no real users
  yet and samples are delete-only.
- **Contributor:** any commit counts (the master spec's "owns or contributed"). Only the first 100
  contributors are read (one API call); a real contributor further down a very large repository is
  refused with `not_your_repo`. The page does not show owner/contributor (not stored).
- **GitHub responses:** renamed repositories (301) are followed; an empty repository's contributors
  (204) is an empty list; "too large to list contributors" (403) means only the owner rule applies;
  rate-limited (403/429 with no calls left) and 5xx or timeouts are `github_unavailable`.
- **Email-only accounts that never confirmed their email** cannot connect GitHub (existing rule)
  until the email service exists (Step 0b); they can still publish without a GitHub link.
- **Rate limit:** an import makes up to 3 calls, a save with a changed link up to 3; the shared 60 per
  hour is for local use only. `GITHUB_API_TOKEN` before testers (DEFERRED to deploy).

## Calls made during the build (Claude's, Bek can override)

- The two steps live in the page's state, not in the address (`?manual=1` from the plan dropped):
  browser Back leaves the add page, and the hand-filled path has no way back to step 1 (reload the
  page). The step bar marks step 1 done only after an import.
- An edit runs every cheap check (sample rule, fields, images, video-or-image rule) before any GitHub
  call (branch review).
- Malformed GitHub answers are `github_unavailable`, never a 500.

DEFERRED: a per-user throttle on `/me/projects/import` (one user can use up the shared GitHub quota;
with `GITHUB_API_TOKEN` at deploy the quota is 5000/hour).

## Left to the builder

Component split, the fake GitHub's shape, exact texts.
