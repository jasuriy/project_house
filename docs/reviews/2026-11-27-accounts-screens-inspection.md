# Accounts screens (step 2 design): inspection

Date: 2026-11-27. Scope: `docs/design/accounts-screens/` (brief.md, auth.css, signup.html, login.html,
header-states.html and their screenshots). Design mockups, not app code. Read-only review.

Method: every view rendered with Playwright from `http://127.0.0.1:8765/accounts-screens/` at
1440x900 and 1920x1080 (signup, signup#errors, signup#github, login, login#errors, login#loading,
login#github, header-states). Computed `font-size / line-height / font-weight` collected for every
element with its own text, bounding boxes for the column, card, controls and header groups, keyboard
Tab order walked, focus and invalid styles read after the 0.15s transition. Contrast computed with the
WCAG relative-luminance formula. Checked against `frontend/src/app/globals.css`,
`frontend/src/components/ui/form.tsx`, `feed/feed.tsx`, `project/sections.tsx`, `ui/popover.tsx`,
`docs/design/profile-page/`, `docs/specs/2026-11-27-accounts.md` and the backend
(`backend/app/accounts/schemas.py`, `service.py`, `backend/app/errors.py`). Guidelines: ui-ux-pro-max
UX dataset (rule names cited per finding), web.dev "Sign-in form best practices", WHATWG autofill
table.

Tags: [V] measured or read, [D] derived from the [V] facts named, [A] assumed (with what breaks).
Severity words: blocker / should-fix / nit. "Inherited, DEFERRED" marks a fault that exists in the
live app already; it is reported so it is not copied, but fixing it is a separate task.

## Summary (the five most damaging)

1. **blocker** The autocomplete pairing breaks password managers: sign-up marks the profile handle as
   `username`, but login identifies by email, so the saved login and the login form do not match (#1).
2. **blocker** `signup.html#errors` draws a state that cannot happen (client check errors together with
   the server's `username_taken`), while the errors that will actually happen are not drawn (#2).
3. **should-fix** The username rules are never told before an error, and the live address preview
   would show invalid addresses (`/u/alice k`) as if they were the profile (#3).
4. **should-fix** Reserved names (`admin`, `settings`, ...) are checked only on the server, so the raw
   Pydantic text "username: Value error, this username is reserved" reaches visitors in normal use (#4).
5. **should-fix** The first view a visitor sees (empty form) is not designed; every view is pre-filled,
   and the error lifecycle (focus after submit, when an error clears) is unspecified (#5, #6).

## Findings

### 1. blocker - Autocomplete tokens pair the password with the wrong identifier

Page: signup, login. Elements: Username, Email inputs.

- [V] signup.html:36 `id="username" autocomplete="username"`; signup.html:43 `id="email" autocomplete="email"`;
  login.html:31 `id="email" autocomplete="email"`; spec line 82-85: login is email + password.
- [V] web.dev sign-in form best practices: "For email inputs use `autocomplete="username"`, since
  `username` is recognized by password managers in modern browsers", keeping `type="email"`.
- [V] WHATWG autofill table: `nickname` = "Nickname, screen name, handle: a typically short name used
  instead of the full name"; `username` = "A username".
- [D] On sign-up a password manager stores the credential under the field marked `username`, here
  `alice-k`. On login there is no `username` field, only `email`, so the saved entry is either not
  offered or `alice-k` is filled into the Email box and login fails with "Wrong email or password".
  [A] Exact behaviour differs per manager (Chrome, 1Password, Bitwarden); if a manager ignored the
  token and used heuristics, it might still pick the email, but the brief cites WCAG 2.2 accessible
  authentication (brief:15-16) precisely to rely on the manager, so the contract must be right.
- Guideline: ui-ux-pro-max `accessible-authentication` (Critical) and `autofill-support`.
- Why it matters: the visitor's password manager is the main way people log in without retyping; here
  it fails on the first return visit.
- Fix: sign-up Email `type="email" autocomplete="username"`; sign-up Username (the handle)
  `autocomplete="nickname"`; login Email `type="email" autocomplete="username"`. Passwords stay
  `new-password` / `current-password`. Update brief:15 to match.

### 2. blocker - `signup.html#errors` shows an impossible state; the real states are missing

Page: signup, `#errors`.

- [V] signup.html:69-71 and the screenshot `signup-errors-1440.png`: "This username is taken" shown
  together with "Enter an email address like name@example.com" and "Use at least 8 characters".
- [V] brief:23-28: the page checks the fields itself on submit and shows every problem at once;
  `username_taken` / `email_taken` come only from the server. [V] service.py:28-29: the 409 carries
  one code.
- [D] When the email or password fails the client check, nothing is sent, so the server cannot answer
  `username_taken` in the same moment. The drawn combination cannot come from a single submit; it
  appears only if an earlier server answer is kept across submits (got "taken", then broke the email
  and password, resubmitted), which the brief does not specify. That is a decision #6 must cover
  (recommended: a server "taken" stays until the username is edited). Either way the picture is not
  what a first submit produces, and the build will be compared with it.
- [D] Two real states are therefore undrawn: (a) client check, all fields at once (name empty,
  username format, email shape, password length); (b) a server 409 after the client check passed: one
  field red, the others normal.
- Guideline: ui-ux-pro-max "Error Placement" (High), `error-clarity`.
- Why it matters: the reviewer and the builder judge errors from a picture that does not match any
  real moment.
- Fix: split into `#errors` (client check: e.g. empty Name, `Alice K` username with the format
  message, `alice.example.com`, `horse`) and `#taken` (all fields valid, only Username red with
  "This username is taken"; and a variant for Email with the server's own text "An account with this
  email already exists", service.py:29).

### 3. should-fix - Username rules are never shown up front; the preview can show an invalid address

Page: signup, Username hint.

- [V] signup.html:37 the only hint is "Your profile: /u/alice-k". [V] schemas.py:13 pattern
  `^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$`; schemas.py:17-18 input is trimmed and lowercased.
- [V] brief:12-13: the preview "updates as typed; lowercase". [D] Typing `Alice K` gives
  `/u/alice k`, an address that cannot exist, shown as if it will.
- [D] A visitor learns the rule (3-30 characters, letters, digits, hyphens, no hyphen at either end)
  only after submitting.
- Guideline: ui-ux-pro-max "form helper text" (no direct dataset row; closest `error-clarity`:
  "state cause + how to fix"); the rule-before-error part is my own reasoning.
- Why it matters: the username is permanent public identity; guessing its rules by trial is the most
  likely sign-up failure.
- Fix: empty or invalid value: hint reads "3-30 letters, digits or hyphens"; valid value: hint reads
  "Your profile: /u/alice-k". One line, same slot, never both. Draw both versions.

### 4. should-fix - The 422 fallback shows raw Pydantic text, and it is reachable in normal use

Page: signup, any field.

- [V] Ran `SignUp(...)` from `backend/app/accounts/schemas.py` in-process (no server, no writes):
  `('username',) | Value error, this username is reserved`,
  `('email',) | Value error, enter an email address like name@example.com`,
  `('password',) | String should have at least 8 characters`.
  [V] errors.py:35-37 sends `"<field>: <msg>"` for the first error only.
- [V] schemas.py:12 the reserved list (`new, login, signup, api, admin, settings, u, projects`)
  lives only on the server; the brief does not give it to the client.
- [D] A visitor who picks `admin` passes every client check and receives the fallback, which per
  brief:25-27 is shown under the field as "Value error, this username is reserved".
- [V] The server's field name is `display_name` (schemas.py:53) but the form's field is `name`
  (signup.html:31); the brief's "field its `field:` prefix names" needs that mapping stated.
- Why it matters: "Value error, ..." in a sign-up form reads as a broken site.
- Fix: copy the reserved list into the client check and answer it with the same words as a taken
  name, "This username is taken" (the visitor does not need the reason). For any other 422, strip
  the `"<field>: "` prefix and Pydantic's `"Value error, "`, capitalise, and map `display_name` to Name.

### 5. should-fix - The empty first view is not designed

Page: signup, login (default views).

- [V] signup.html:31,36,43,50 and login.html:31,37: every default view is pre-filled
  (`Alice Karimova`, `alice-k`, `correct horse`). No placeholders are defined anywhere.
- [D] Undecided: what the Username hint says when the box is empty (see #3), whether boxes have
  placeholders, and how the empty form looks at 1920 with the wide step.
- Why it matters: a first-time visitor sees empty boxes; that is the screen Bek approves by eye, and
  it does not exist.
- Fix: make the default view empty (no placeholders: labels already say what goes in; a placeholder
  would repeat the label) and move the filled example to `#filled`.

### 6. should-fix - Error lifecycle unspecified: focus after submit, announcement, clearing

Page: signup, login.

- [V] brief:23-31 says errors appear on submit and are linked with `aria-describedby`; it says
  nothing about where focus goes, how errors are announced, or when they disappear.
- [V] form.tsx:67 the kit's message is `role="status"`; the mockup's errors (signup.html:38,44,54)
  have no role. [D] Three `role="status"` messages appearing at once would be read in a burst.
- Guideline: ui-ux-pro-max `focus-management` ("without a summary, focus the first invalid field"),
  "Error Messages" (must be announced), `inline-validation`.
- Why it matters: a keyboard or screen-reader user presses Sign up and hears nothing; a sighted user
  fixes a field and the red text stays until the next submit.
- Fix (state it in the brief): on a failed submit move focus to the first invalid field (its error is
  read through `aria-describedby`); no live role on field errors; once a field has shown an error,
  re-check it on input and remove the error as soon as it is valid; the form-level message keeps
  `role="alert"`.

### 7. should-fix - "The upload page's Field kit" is not what is drawn

Page: signup, login. Elements: hint and error lines.

- [V] form.tsx:23-73 `Field` has no hint slot; its under-box `message` is plain red text, no icon,
  `id="${id}-message"`, `role="status"`; its default invalid target is the label-row "Missing"
  (`${id}-error`, form.tsx:52, :78).
- [V] The mockup adds a grey hint under the box (signup.html:37,53, auth.css:85) and an under-box
  error with a warning icon, `id="${id}-error"` (signup.html:38, auth.css:87-88).
- [D] Building this as drawn means changing the kit or forking a second field style; the brief claims
  reuse (brief:8, auth.css:72).
- Why it matters: two different "field error" looks in one app (upload vs sign-up).
- Fix: extend `Field` with a `hint` prop and give its `message` the same icon as "Missing", then use it
  on both pages. Or drop the icon here. Pick one and write it in the brief.

### 8. should-fix - The account menu as drawn cannot be the existing Popover as is

Page: header-states, menu open.

- [V] brief:47-48: the menu "is the existing `Popover`". [V] popover.tsx:85-89: panel
  `role="dialog"`, fixed `p-[12px]`; `panelClassName` replaces only the placement classes
  (popover.tsx:73-74), not the padding.
- [V] header-states.html:44 `role="group"`; auth.css:44 `padding: 6px` ("the feed's More list look").
- Why it matters: the build either changes a shared component or ships a menu that does not match the
  approved picture.
- Fix: decide in the brief: (a) use Popover as is (12px padding, `role="dialog"`, `width={240}`,
  `align="right"`) and redraw the mockup with 12px; or (b) add a `padding` option to Popover. I
  recommend (a): no shared-component change for a one-item menu. Make the mockup's role match
  (`dialog`).

### 9. should-fix - The card does not step up at the wide size, so the content gets narrower as text grows

Page: signup, login at 1920.

- [V] Measured: card 400px at both 1440 and 1920; padding `var(--pi)` 24 -> 32px (auth.css:61,
  globals.css:96); submit (inner width) 351px at 1440, 335px at 1920; title 40 -> 56px, body 15 -> 17px.
- [D] At the wide step every font grows one step while the line length shrinks by 16px; the 56px
  title over a 335px-wide form reads top-heavy (screenshot `login-1920.png`).
- Why it matters: the wide step exists to keep proportions on big screens; here it inverts them.
- Fix: at `min-width: 106.25rem` set the column `max-width: 464px` (keeps the inner width at about
  400px with 32px padding). Re-measure.

### 10. should-fix - Brief and mockup disagree on where the switch line sits

Page: signup, login.

- [V] brief:8-9 "Button 'Sign up' ... Under it: 'Already have an account? Log in'"; brief:17 same
  order for login. [V] signup.html:23 and login.html:23 put it under the h1, above the card.
- Why it matters: Bek approves one, the builder reads the other.
- Fix: keep the mockup's position (a returning visitor sees "Log in" before typing into a sign-up
  form) and correct brief:9 and brief:17.
- Owner decision: switch line above the form or under the button? Recommended: above (as drawn).

### 11. should-fix - `next` is lost between the two forms; sign-up's destination is not stated

Page: signup, login; feed empty state.

- [V] signup.html:23 `href="login.html"`, login.html:23 `href="signup.html"`: no `next` carried.
  [V] brief:58-63 defines `next` for login and for logged-in visits; nowhere says where a new
  account lands after sign-up.
- [V] brief:42-43: the feed's empty-state Add project, for a visitor, "leads through login".
  [D] A visitor on an empty site has no account; sending them to Log in costs one extra click and a
  wrong first screen.
- Why it matters: a visitor who clicked Add project, then "Sign up" on the login page, ends on the
  feed instead of the upload page.
- Fix: both switch links keep the current `?next=`; after sign-up go to `next`, else the feed (state
  it); a visitor's empty-state Add project goes to `/signup?next=/new`.

### 12. should-fix - Header has no rule for `/auth/me` failing with anything but 401

Page: all headers.

- [V] brief:53-54 covers "checking" (right side empty); brief:39 covers logged out. Nothing covers a
  500, a timeout or a network error.
- [D] If any failure is treated as logged out, a logged-in person sees "Log in / Sign up": the wrong
  state the brief says it avoids.
- Fix: 200 = logged in; 401 = logged out; any other failure = the right side stays empty.

### 13. should-fix - Missing views and unwritten copy

Page: signup, login, `#github`.

- [V] Named in the brief but not drawn: sign-up loading "Creating account..." (brief:31); login
  "Too many failed logins..." (brief:29); network failure on both (brief:30) has no wording at all.
- [V] Not named and not drawn: login with an empty or malformed email (the login schema does not check
  shape, schemas.py:59-62, so the client decides); a server 5xx on either form; the step-4 GitHub
  failure where the GitHub email already has a password account (spec:54-57, the person "is asked to
  log in with the password instead"); GitHub cancelled or state mismatch. The brief says the screen
  is "designed once" (brief:19).
- Fix: write the copy now, e.g. network/5xx: "Could not reach Prostagram. Check your connection and
  try again."; GitHub email clash: "This email already has an account. Log in with your password."
  (form-level message on /login). Add `#loading` to sign-up. GitHub failures may be marked
  "step 4" explicitly instead of drawn now.

### 14. should-fix - Show/Hide: double state signal, no "password" in its name, below the brief's own target

Page: signup, login. Element: `.reveal`.

- [V] signup.html:51,84: the button changes its text Show -> Hide and also sets `aria-pressed`.
  [D] A screen reader announces "Hide, toggle button, pressed": two signals that contradict each
  other (pressed + an action word for the opposite state). The accessible name is "Show" with no
  mention of the password.
- [V] web.dev: the toggle should carry an `aria-label` naming the password ("Show password" /
  "Hide password").
- [V] Measured 55x32px at 1440 (60x32 at 1920). Passes WCAG 2.5.8 (24px) but fails the brief's own
  bar, brief:75 "targets >= 36px desktop". [V] Width jumps 55 -> 49px when the label turns to "Hide".
- Guideline: ui-ux-pro-max `password-toggle`, Target Size (Minimum).
- Fix: drop `aria-pressed`; visible text Show/Hide; `aria-label` "Show password" / "Hide password";
  height 36px (`right: 4px`, fits the 44px box); `min-width` equal to the wider label so it does not
  jump.

### 15. should-fix - Input borders at 1.50:1 (inherited, DEFERRED)

- [V] `--box-line #d3d1e0` on white = 1.50:1 (auth.css:7, form.tsx:17). Same for the GitHub
  button border (auth.css:67).
- [D] WCAG 1.4.11 asks 3:1 for the boundary that identifies a control. The label above each box
  helps, but the box edge itself is near invisible to low-vision users. The live upload form has the
  same value, so this is a site-wide token change, not a fault of this design.
- Fix (separate task): a box line of at least 3:1, e.g. a grey around `#8f8da8`, checked by eye
  against the approved upload page.

### 16. nit - Focused invalid field looks different in the mockup and in the app

- [V] Measured in signup#errors with Email focused: border `rgb(185,28,28)` (red) plus the indigo
  halo; auth.css:79 (`:focus`) and :81 (`[aria-invalid]`) have equal specificity and the later wins.
- [D] In the kit, `focus:border-primary` and `border-danger` are Tailwind utilities (form.tsx:16-17);
  in Tailwind v4 variant utilities are emitted after plain ones, so a focused invalid box turns indigo.
  [A] if the ordering differs, the two would match.
- Fix: decide which one you want (I recommend red stays while focused: the error is still true) and
  make the kit and the mockup agree.

### 17. nit - At 1920 "Log out" is bigger than "Add project" (inherited, DEFERRED)

- [V] Measured at 1920: header buttons 13px (fixed, as feed.tsx:17), menu item 17px, avatar letter
  17px, menu name 17px.
- Fix (separate task): header buttons on `--fs-cap` so they step up with the rest, or menu text on
  `--fs-cap`. Not this design's fault; do not copy the mismatch into new parts.

### 18. nit - Account menu items 15px; the More list it copies uses 14px (inherited, DEFERRED)

- [V] auth.css:48 menu item `var(--fs-body)` (15px); feed.tsx:107 More items `text-[14px]`;
  feed.tsx:70 tabs `text-[14px]`. 14px is off the 13/15/17/40 scale.
- Fix: keep 15px here; move the feed's 14px to the scale in a separate task. The brief's "the feed's
  More list look" (auth.css:43) should say "except the off-scale 14px".

### 19. nit - One-off line height and radius

- [V] auth.css:46 `.menu__name` line-height 1.4 (21px / 23.8px measured) while every other body-size
  text is 1.5. [V] auth.css:83 `.reveal` radius 6px, the only 6px radius; others are 8, 10, 12, 16.
- [V] auth.css:61 card padding `var(--pi)` (24/32) while the "upload page's section card" it names
  uses `p-[20px]` (form.tsx:216).
- Fix: menu name line-height 1.5; reveal radius 8px; either say the card padding is new or use 20px.

### 20. nit - New raw hex colours for the form-level error

- [V] auth.css:91 `#f3c4c4` border, `#fdf2f2` background; not in globals.css. Text contrast is fine
  (danger on `#fdf2f2` 5.90:1).
- Fix: add `--color-danger-line` and `--color-danger-bg` tokens when building.

### 21. nit - Landmarks differ between the two header states

- [V] header-states.html:27 logged-out group is `<nav aria-label="Account">`; :41 and :74 logged-in
  group is a plain `<div>`.
- Fix: same element in both (a `<nav aria-label="Account">` or neither).

### 22. nit - The "keep its width empty" rule protects nothing

- [V] Measured right group width: logged out 153px, logged in 180px. Search box x=440 (1440) / 680
  (1920) in both states: the feed header's `1fr | 560px | 1fr` grid (auth.css:26) keeps it fixed; the
  project header is `space-between` with the logo pinned left.
- [D] Nothing moves when the group appears, and the two states have different widths, so "keeps its
  width" has no defined value.
- Fix: replace brief:53-54 with "renders nothing while checking; nothing else in the header moves".

### 23. nit - "Try again in 15 minutes" overstates

- [D] service.py:96-104 counts failures inside a rolling 15-minute window; the lock ends when the
  oldest failures age out, i.e. in at most 15 minutes, often less.
- Fix: "Too many failed logins. Try again later." or "... in a few minutes." (server text,
  service.py:113, and brief:29).

### 24. nit - Form-level alert built as a hidden element; repeat failures not re-announced

- [V] login.html:42 the `role="alert"` paragraph is always in the DOM and shown by toggling `display`.
- [A] Screen readers announce `role="alert"` reliably on inserted content or changed text, less
  reliably when a hidden node is shown; the same "Wrong email or password" twice in a row is often not
  re-announced. If this is wrong, nothing breaks, but it is cheap to avoid.
- Fix (build note): insert the alert element on error and remove it on the next submit.

### 25. nit - Small header details

- [V] auth.css:39-40 the avatar button has no hover state (only the open ring).
- [V] brief:46 "Your profile" will join the menu as a separate item under the name block.
  [D] Name block and "Your profile" would then be two elements for one destination.
- [V] auth.css:96 loading button at `opacity: .7` gives white on the blend 3.41:1. Disabled
  controls are exempt from 1.4.3, but "Logging in..." is the only status text.
- Fix: avatar hover ring like the open state, lighter; when the profile ships, make the name block
  itself the profile link instead of adding "Your profile"; loading button at full colour with
  `cursor: progress`, and `aria-busy="true"` on the form.

## The three open questions: evidence only

- **Q1 (no Add project when logged out).** [V] spec:101 "'Add project' when logged out goes to
  `/login?next=/new`". It can be read as assuming the header button stays for visitors, or as
  describing only the empty-state button and typed `/new`. Ambiguous; if Bek says yes, the brief
  should name spec:101 as the line it amends. See also #11: the visitor route should be sign-up, not
  login. Does the evidence argue against the recommendation? No: the only counter-evidence is a
  possibly conflicting spec line, which is a wording fix, not a reason to keep a third button. One
  correction to the brief's reasoning (brief:40-41): Add project would not lead to "the same login
  screen" as Sign up; it leads to Log in with `next=/new`, a different door. That makes it worse for a
  new visitor, not better, so the recommendation stands.
- **Q2 (narrow card).** [V] At 1920 the column is 400px of 1920 (about 21%); the login content ends at
  y=524 of 1080, sign-up at y=764. At 1440 login ends at y=479 of 900. These are the facts for the
  1920 screenshot. #9 applies whichever way he decides.
- **Q3 (project page gets the login state).** [V] Today's SiteHeader has the logo only
  (sections.tsx:34-47); the profile design notes say the header states come from this step
  (profile-page/design-notes.md:38). No evidence against.

## Proposed type scale (already the live scale; keep it)

| Role | Size / line height / weight (desktop) | Wide >= 1700px | Used here by |
|---|---|---|---|
| Page title | 40 / 1.1 / 700 | 56 | h1 Sign up, Log in |
| Section title | 17 / 28 / 600 | 21 | (unused on these pages) |
| Body, controls | 15 / 1.5 / 400-600 | 17 | inputs, switch line, submit, GitHub, menu name and item, form error |
| Label, hint, error, caption | 13 / 20 / 400-500 | 15 / 24 | field labels, hints, field errors, "or", @handle, Show/Hide |
| Logo | 17 / 1.5 / 700 (fixed) | 17 | logo |
| Header buttons | 13 / 600 (fixed, inherited) | 13 | Log in, Sign up, Add project (see #17) |

## Proposed spacing, radius and colour set

| Kind | Values in use | Proposed |
|---|---|---|
| Radius | 6 (reveal), 8 (header buttons, menu items), 10 (boxes, submit, GitHub, form error), 12 (menu), 16 (card), 50% avatar | 8 small controls inside a box or list, 10 boxes and form buttons, 12 popovers, 16 cards; drop 6 |
| Spacing | 64 page top, 48 sides, 8 title to switch, 24 switch to card, 16 between fields, 6 label/box/message, 24/32 card padding | keep; card padding stays `--pi`, say it is new (#19) |
| Card width | 400 at all widths | 400, and 464 at >= 1700px (#9) |
| Control heights | 44 boxes, submit, GitHub; 40 header buttons and avatar; 36 menu items; 32 reveal | 44 / 40 / 36; reveal 36 (#14) |
| Colours | tokens from globals.css; raw `#a9a7c0`, `#cfcbf6` (inherited), `#f3c4c4`, `#fdf2f2` (new) | tokens `--color-danger-line`, `--color-danger-bg` (#20) |

## Checked and fine

- Every text element is on the scale at both widths [V]: 1440 uses 13/15/17/40 only, 1920 uses
  15/17/56 (plus the fixed 13px header buttons and 17px logo, both as in the live app).
- No sideways scroll [V]: `scrollWidth` 1440 and 1920 in all 16 view/width runs; no vertical scroll either
  (`scrollHeight` equals the viewport height in every run; the tallest, sign-up#github, ends at
  y=799 of 900 at 1440).
- Golos Text loaded [V]: `document.fonts` entries for Golos show status `loaded` for weights 400,
  500, 600 and 700 (the Latin subset; other subsets stay unloaded as expected), so the measured
  widths are with the real font.
- Text contrast [V]: muted on white 6.65, muted on page 6.12, faint on white 5.04, danger on white
  6.47, danger on `#fdf2f2` 5.90, link `#4338ca` on white 7.90 and on page 7.27, white on primary
  6.29, avatar letter on badge 8.19. All pass 4.5:1.
- Header geometry matches the live parts [V]: SiteHeader 52px tall, 48px side padding
  (sections.tsx:37); feed header 68px, `1fr | 560px | 1fr` grid, search 560px; logo 17px bold, 44px
  tall; `.btn-primary` matches feed.tsx:17 (40px, radius 8, 16px padding, 13px 600, same shadow).
- Avatar letter fallback matches the profile design (badge background, primary-ink text,
  profile.html:54) [V]; the photo case loads [V] (`author.jpg`, 640px natural width).
- Menu placement [V]: right edge aligned with the avatar (1392px), 8px below it, 240px wide; Log out
  is a `<button>`; avatar button 40x40 with `aria-expanded`, `aria-controls`, name "Account menu".
- Keyboard order [V]: logo, switch link, Name, Username, Email, Password, Show, submit; focus ring
  visible on links and buttons; inputs show the indigo border and halo.
- Labels [V]: every input has a visible `<label for>`; `aria-describedby` points at the hint in the
  normal view and at the error in the error view; `aria-invalid` set only on failing fields.
- Field constraints match the spec [V]: name maxlength 60, username 30, password 128; paste not
  blocked; `type="email"` on email; `new-password` / `current-password` correct.
- One name per action holds [V]: header, h1, submit and switch links all say "Sign up" / "Log in";
  no "Register", "Sign in" or "Create account" on any control (only the loading text "Creating
  account...", brief:31, which is a status, not a control name).
- No Forgot password link (A2) and no email confirmation copy [V]; nothing promises a feature that
  does not exist.
- Screenshots are newer than their sources [V]: HTML/CSS last written 15:38-15:40, PNGs 15:40-15:41;
  `signup-errors-1440.png`, `header-states-1440.png` and `login-1920.png` inspected and match the
  rendered pages.
- `prefers-reduced-motion` turns off the spinner and transitions [V] (auth.css:103).
