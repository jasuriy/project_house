# Accounts step 2: sign-up, login and header (design, desktop 1440)

APPROVED by Bek 2026-11-27 (questions 1-3: yes). Spec: docs/specs/2026-11-27-accounts.md. Phone after Bek
approves the desktop. Inspection: docs/reviews/2026-11-27-accounts-screens-inspection.md (25
findings; how each was settled is in the last section).

## Screens

1. **`/signup`**: h1 "Sign up", under it "Already have an account? Log in" (a returning visitor sees
   it before typing). One white card with Name, Username, Email, Password and the button "Sign up".
   One name for the action everywhere: header, h1, button, links and the waiting text ("Signing
   up...") all say Sign up; the other page says Log in.
   - Username hint, one line under the box: the rule ("3-30 letters, digits or hyphens") while the
     value is empty or not valid; once it is valid, the address it makes ("Your profile:
     /u/alice-k", lowercase, as the server stores it).
   - Password hint: "At least 8 characters".
2. **`/login`**: h1 "Log in", under it "New to Prostagram? Sign up". Card: Email, Password, button
   "Log in". No "Forgot password" link (A2: later).
3. **Both pages open empty, with no placeholders** (the labels say what goes in; a placeholder would
   repeat them).
4. **Password Show/Hide**: a button inside the box, visible text Show / Hide, accessible name "Show
   password" / "Hide password", 36px tall, fixed width (no jump when the text changes).
5. **Browser and password-manager help**: sign-up Name `autocomplete="name"`, Username
   `nickname` (the WHATWG token for a handle), Email `type="email" autocomplete="username"`,
   Password `new-password`; login Email `type="email" autocomplete="username"`, Password
   `current-password`. Email is what people log in with, so it is the field password managers save
   as the user name. Paste is never blocked (WCAG 2.2 accessible authentication).
6. **"Continue with GitHub"** above the fields with an "or" divider: drawn now, ships in step 4. The
   mockups open without it (the step-2 view the build is compared with); `#github` shows step 4.
   Its failures (cancelled, email already used by a password account: "This email already has an
   account. Log in with your password.") are designed in step 4.
7. **Layout**: the site header (logo only); a column centred on the page background: the title on
   the background, the form in a white card (16px radius, 1px line, padding `--pi` 24px, new for
   these pages). Column 400px; at the wide step (>= 1700px) 464px, because the card padding grows
   to 32px and the form must not get narrower while the text grows [open question 2].

## Errors

- **The page's own check, on pressing the button.** Every field at once, in plain words, under
  its box (the slot where the hint was), red text as in the kit, the box red, `aria-invalid`, and
  `aria-describedby` pointing at the message. Focus moves to the first field with a problem, which
  reads its message out. Once a field has shown a problem it re-checks as you type and clears as
  soon as it is right. Messages:
  - Name empty: "Enter your name"
  - Username empty: "Choose a username"; wrong shape: "Use 3-30 letters, digits or hyphens, with
    no hyphen at the start or end"; a reserved word (the server's list, copied): "This username
    is taken" (the visitor does not need the reason)
  - Email empty: "Enter your email"; wrong shape: "Enter an email address like name@example.com"
  - Password under 8: "Use at least 8 characters"
  - Login: "Enter your email", "Enter your password"
- **The server's answers that belong to a field** (sign-up 409): "This username is taken" under
  Username, "An account with this email already exists" under Email. A "taken" stays until that
  field is edited.
- **The server's answers that belong to no field**, one message above the button, added when the
  answer comes and removed on the next try (so a repeat is read again), `role="alert"`:
  - 401: "Wrong email or password"
  - 429: "Too many failed logins. Try again in a few minutes." (the server's text changes from "in
    15 minutes": the lock ends when the oldest failures are 15 minutes old, often sooner)
  - no answer or a 5xx: "Could not reach Prostagram. Check your connection and try again."
  - any other 422 (should not happen after the page's check): the server's message with its
    `field:` prefix and Pydantic's "Value error, " removed, under the field it names
    (`display_name` is the Name field).
- **Waiting**: the button keeps its full colour, shows a spinner and "Signing up..." / "Logging
  in..."; the form is `aria-busy`; a second press does nothing.

## Header (feed and project page)

- **Logged out**: "Log in" (quiet button) and "Sign up" (primary) [open question 1]. `/new` typed
  directly redirects to `/login?next=/new`. This amends the spec line "Add project when logged out
  goes to /login?next=/new": there is no Add project button for visitors.
- **Logged in**: "Add project" (primary, as today) and the avatar (36px circle in a 40px button:
  photo, or the first letter of the name, as on the profile page; a light ring on hover, the
  primary ring while open). The avatar opens the existing `Popover` as it is (role dialog, 12px
  padding, width 240, right-aligned; Escape and a click outside close it, focus returns to the
  avatar): name and @username, a line, then "Log out", a `<button>` that POSTs from the browser.
  When the profile page ships, the name block itself becomes the link to it (no separate "Your
  profile" item).
- Both groups are `<nav aria-label="Account">`.
- **Project page header** gets the same group [open question 3]. **Upload page header** unchanged.
- **While the server checks the cookie** the group renders nothing; nothing else in the header
  moves. `/auth/me` 200 = logged in, 401 = logged out, any other failure = nothing shown (never
  "Log in" to a person who is logged in).

## Logic (also in the spec)

- `next` must be a page of this site: it is parsed as a URL (`frontend/src/lib/next-path.ts`),
  another origin, or a cleaned path starting with `//` (`/x/..//evil.com`), falls back to `/`.
  Tested in `frontend/src/lib/next-path.test.mjs` (`npm test`).
- The two switch links keep `?next=`. After sign-up or login: `next`, else the feed. The feed's
  empty state (no projects at all) sends a visitor to `/signup?next=/new`.
- A logged-in visit to `/login` or `/signup` goes to `next` or the feed.
- After sign-up, login and logout the page navigates fully, so the server-drawn header shows the
  new state.
- The header asks `/auth/me` in its own Suspense boundary, so the feed does not wait for it.

## Build notes (the parts reused)

- The upload page's `Field` kit gains a `hint` (grey line in the message slot) and an option to
  leave out the message's live role (focus already reads it); the upload page does not change.
- A focused box is indigo even with an error, as in the kit today.
- The username rules (pattern and reserved words) come to the page from `/catalog`, which already
  carries `text_limits`, so the page and `schemas.py` cannot drift apart.
- The header and the feed's empty state both need the user; the `/auth/me` call is wrapped in
  React `cache()` so it runs once per request.
- New tokens: `--color-danger-line` (#f3c4c4), `--color-danger-bg` (#fdf2f2) for the message above
  the button.

## Views (mockups in this folder, local server)

- `signup.html`: empty; `#filled`; `#errors`; `#taken`; `#offline`; `#loading`; `#github`
- `login.html`: empty; `#filled`; `#check`; `#errors`; `#locked`; `#offline`; `#loading`; `#github`
- `header-states.html`: feed logged out; feed logged in with the menu open; project page logged
  out; project page logged in

## Questions for Bek

1. Logged-out header: "Log in" + "Sign up", no "Add project". Recommend yes.
2. Sign-up and login as a narrow centred column instead of filling the width. Recommend yes: a
   form is the only thing on these pages, and wider boxes make long lines with nothing beside
   them. Judge it from the 1920 screenshot.
3. The project page header gets the login state too. Recommend yes.

## How the inspection was settled

Fixed in the design: 1-6, 8-14, 19, 21-25. Settled toward the existing kit so the upload page does
not change: 7 (red text without an icon; the kit gains a hint), 16 (focus wins). 23: the server's
429 text changes in the step-2 build. DEFERRED, faults already in the live app, not copied into
new parts: 15 (box border contrast 1.50:1), 17 (fixed 13px header buttons at the wide step), 18
(the feed's 14px), 20 is a build note.

## Build plan (step 2)

Backend (small, needs a Modal deploy before the frontend goes live):
1. `/catalog` gets `username_rules` (pattern, reserved words) taken from `app/accounts/schemas.py`,
   so there is one source. Test.
2. The 429 text becomes "Too many failed logins. Try again in a few minutes." Test updated.

Frontend:
3. `lib/api.ts`: `Me`, `api.signUp / logIn / logOut` (browser fetches through `/api`).
4. `lib/server-api.ts`: `getAccount()` wrapped in React `cache()`: reads only `ph_session` from
   `cookies()`; no cookie = logged out without a request; `/auth/me` 200 = logged in, 401 = logged
   out, anything else = unknown (header shows nothing).
5. `lib/next-path.ts`: `safeNext(raw)`: parsed with `new URL(raw, "http://x")`; if the origin is not
   `http://x` the answer is `/`, else `pathname + search + hash`. (A character check would let
   `/<tab>/evil.com` through: browsers drop tabs and newlines, which leaves `//evil.com`.) The one
   function serves the server redirect, the browser's navigation and the switch links.
6. `components/account/account-nav.tsx` (server): the header group; `account-menu.tsx` (client):
   avatar button + the existing Popover + Log out (POST, then reload the page).
7. `FeedHeader` and `SiteHeader` take the group in their own `<Suspense fallback={null}>`.
8. `components/ui/form.tsx`: `Field` gets `hint` and `announce`; `TextField` passes through
   `name`, `autoComplete`, `autoCapitalize`, `spellCheck`, points `aria-describedby` at the hint
   when there is no error, and gets a slot at the right end of the box (Show/Hide) with matching
   padding. Defaults unchanged, so the upload page does not change.
9. `/signup`, `/login` pages (server, the reading part inside `<Suspense>` as cacheComponents
   requires): logged in -> `redirect(safeNext(next))`; otherwise the
   client form gets the username rules (from the catalog) and `next`. On success
   `window.location.assign(next)` (full navigation, the header redraws).
10. `FeedEmpty`: a visitor gets `/signup?next=/new`, a logged-in person `/new`.
11. `globals.css`: `--color-danger-line`, `--color-danger-bg`.

Not in step 2: the `/new` redirect for visitors and "Render needs login" go together in step 3, so
the page guard and the server rule arrive at the same time.

Verification: ruff + pytest; `tsc`, `eslint`, `next build`; local run (API on the test database,
fake R2, `next start`): every mockup view rebuilt in the app and compared at 1440 and 1920; the
behaviours (empty submit, hint, reserved name, taken, wrong password, lock, Show/Hide, focus);
the rendered `autocomplete` of every input; the `next` cases (`/projects/reflex`, `//evil.com`,
`/\evil.com`, `https://evil.com`, `/%09/evil.com`, `/%0A/evil.com`) after login AND on a logged-in
visit (where the browser lands, not which call ran); header logged out and logged in on the feed
and the project page; logout. Page by page: `/signup` matched at 1440 and 1920, then `/login`, then
the headers. Playwright cookies cleared before logged-out checks. Then the app-inspector, the advisor, then Bek.
Deploy order with Bek's yes: commit, Modal deploy, check `/api/v1/catalog` has `username_rules`,
then push (Vercel; the push also carries step 1, 4cdc4ca).
