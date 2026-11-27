# Accounts step 2, built: inspection (2026-11-27)

Scope: the uncommitted step-2 build (sign-up page, login page, header account group on the feed
and the project page, form-kit change, backend `username_rules` and 429 text), at desktop 1440x900
and 1920x1080. Phone is not reviewed. Read-only: no source was edited.

Method:
- Running app: `next start` on http://localhost:3000, API on the throwaway database.
- Mockups: http://127.0.0.1:8765/accounts-screens/.
- Measurements: Playwright (`getBoundingClientRect` and `getComputedStyle` on every element of
  the form and the header, compared key by key between mockup and app), plus curl and Node.
- Guidelines: ui-ux-pro-max, ux domain. "Focus States" (High), "Error Placement" (High),
  "Loading Buttons" (High), "Password Visibility". Where a WCAG criterion is cited without a
  search hit, it is my own reference and labelled so.
- Tags: `[V]` measured or run, `[D]` derived from verified facts or from reading code,
  `[A]` assumed.

Accounts I wrote to the test database: `audit-one` / `audit1@example.com` (sign-up), the 409
probes, and login failures for `audit1@example.com`, `lock-audit-7@example.com` (locked by the
429 test) and `dbl-audit@example.com`. The given account `next2@example.com` / "next test 123"
answered **401** to a login through `/api/v1/auth/login` `[V]`. I did not look into why.

Scratch evidence (screenshots):
`C:\Users\HP\AppData\Local\Temp\claude\390d087a021edb9c\b3208616-ebb7-463a-b05d-de381d1d4a22\scratchpad\`
holds `app-signup-1440.png`, `app-signup-1920.png`, `app-login-1440.png`, `app-login-1920.png`,
`app-signup-offline-1440.png`, `app-feed-loggedin-menu-1440.png` and
`app-menu-open-keyboard-1440.png`.

---

## Summary

1. **BLOCKER. Open redirect.** `safeNext` returns `//evil.com` for `/.//evil.com`,
   `/x/..//evil.com`, `/%2e%2e//evil.com` and similar inputs. A logged-in visitor who opens such a
   `/login` or `/signup` link lands on the other site. I reproduced this in the browser.
2. **BLOCKER. The password can end up in the address bar.** The forms now have `name`
   attributes but no `method`. If Enter is pressed before the page's script has loaded, the
   browser sends the form as a GET: `/login?email=...&password=...`. I reproduced this.
3. **should-fix.** The spec and the brief say the `next` rule is "tested". The frontend has no
   tests at all, and the case nobody tested is the one that broke.
4. **should-fix. Some keyboard focus is invisible.** The logo link has no focus ring on
   /signup, /login and the feed (`outline-none` without `outline-solid`). The menu's "Log out"
   shows focus only as a background at 1.09:1 against white.
5. **should-fix. The server-side forward can carry more than `ph_session`.** The cookie value
   is URL-decoded before it is put into the `Cookie` header. I verified this with a crafted
   cookie.

Count: 2 blocker, 5 should-fix, 11 nit.

---

## Findings

### 1. [blocker] `safeNext` lets `//host` through after dot-segment removal: open redirect for logged-in visitors

**Where:** `frontend/src/lib/next-path.ts:7-15`, used by `app/login/page.tsx:24-25` and
`app/signup/page.tsx:25-27` (`redirect(next)`).

**What is wrong.**
- `new URL(raw, "http://x")` resolves `.` and `..` path segments *after* the origin check
  passed. The returned `pathname` can then begin with `//`.
- Node, running the function verbatim `[V]` (`node safenext.mjs` in the scratchpad):

  | input | output | where a browser lands from it |
  |---|---|---|
  | `/.//evil.com` | `//evil.com` | `https://evil.com/` |
  | `/x/..//evil.com` | `//evil.com` | `https://evil.com/` |
  | `/..//evil.com` | `//evil.com` | `https://evil.com/` |
  | `/%2e//evil.com` | `//evil.com` | `https://evil.com/` |
  | `/%2e%2e//evil.com` | `//evil.com` | `https://evil.com/` |
  | `/a/%2e%2e//evil.com` | `//evil.com` | `https://evil.com/` |

- The brief's own six cases (`//evil.com`, `/\evil.com`, `https://evil.com`, `/%09/evil.com`,
  `/%0A/evil.com`, `/projects/reflex`) are all handled correctly. Main session verified them in
  the browser; I did not re-check them, apart from the backslash rows below.
- Backslash variants, live, logged in, with the URL-encoded value (curl, `NEXT_REDIRECT` target)
  `[V]`:

  | `next` value | redirect target |
  |---|---|
  | `%2F%5Cexample.com` | `/` |
  | `%5C%5Cexample.com` | `/` |
  | `%2F%5C%5Cexample.com` | `/` |
  | `%2F.%5C%2Fexample.com` | **`//example.com`** |
  | `%2F.%2F%5Cexample.com` | **`//example.com`** |

  Plain backslashes are safe. A backslash combined with a dot segment is the same hole.
- A very long `next` (`/` followed by 8000 characters) answered 200 and redirected to that same
  path. That is harmless.
- Live, logged in (cookie of `audit-one`), with requests to `example.com` intercepted by
  Playwright `[V]`:
  - `GET /login?next=%2F.%2F%2Fexample.com` streamed
    `NEXT_REDIRECT;replace;//example.com;307` and
    `<meta http-equiv="refresh" content="1;url=//example.com">` (curl).
  - The browser ended on `http://example.com/`.
  - `/signup?next=%2Fx%2F..%2F%2Fexample.com%2Fphish` ended on `http://example.com/phish`.
- The post-login and post-sign-up path is safe **only by accident** `[V]`:
  - The page passes the already-cleaned `next` (`//example.com`) to the form.
  - The form calls `safeNext` again (`auth-forms.tsx:173, 270`), and the second pass rejects
    `//`.
  - Logging in with `?next=%2F.%2F%2Fexample.com` landed on `http://localhost:3000/` `[V]`.
- The switch link becomes `/signup?next=%2F%2Fexample.com` `[V]`. That is harmless for the same
  reason.

**Why it matters.** Anyone can post a prostagram link that drops every logged-in visitor on a
phishing copy of the site, with no click needed after opening it.

**Fix.**
- Check the *output*, not only the input:

  ```ts
  const url = new URL(raw, BASE);
  if (url.origin !== BASE) return "/";
  const path = `${url.pathname}${url.search}${url.hash}`;
  return path.startsWith("//") ? "/" : path;
  ```

  For an `http:` URL, WHATWG turns `\` into `/`, so `pathname` can never start with `/\`. The
  `//` check is the only one needed `[D]`, consistent with the table above.

  An equivalent option: return `path` only if `new URL(path, BASE).origin === BASE`.
- Keep a single call site per route. The client's second `safeNext` call is then redundant
  (see 17).
- Cover it with the test in finding 3.

### 2. [blocker] A submit before hydration sends the password in the URL (GET)

**Where:**
- `frontend/src/components/account/auth-forms.tsx:113` (`<form noValidate onSubmit>`, with no
  `method` and no `action`);
- the `name` attributes added through `TextField` hints (`auth-forms.tsx:62, 210, 214, 228,
  282`).

**What is wrong.**
- The form is server-rendered and becomes visible when the streamed Suspense content is
  swapped in by the inline script. React attaches `onSubmit` only after the client chunk has
  loaded and hydrated.
- In that window, or permanently if a chunk fails to load, Enter does a native submit. With no
  `method` that is a GET to the current URL, and every named field goes into the query string.
- Reproduced `[V]` (Playwright: blocked `/_next/static/chunks/**`, then filled the form and
  pressed Enter):
  - the form's `method` and `action` attributes were `null`;
  - the page navigated to
    `http://localhost:3000/login?email=nobody%40example.com&password=secret+pass+1`.
- Sign-up has the same markup `[D]`, so name, username, email and password would all go into
  the URL.

**Why it matters.** The plaintext password ends up in browser history and in the hosting
provider's request logs (Vercel).
- It happens when Enter is pressed, or a password manager submits, after the form is visible
  but before the client chunk has run, or when a chunk fails to load.
- How wide that window is on a slow connection was not measured `[U]`. I rate it blocker
  because a credential leaks in plain text and the fix is one attribute.

**Fix.**
- Add `method="post"` to the `<form>` in `FormCard`.
- An early submit then becomes a POST body to the Next page, which is not logged and not in
  history `[A]`: Next renders the page for a POST without a server-action header. Verify with
  the same blocked-chunk test.
- Keep the `name` attributes; password managers use them.

### 3. [should-fix] The `next` rule has no test, although the spec and the brief say "tested"

**Where:**
- `docs/specs/2026-11-27-accounts.md:105-106` ("...fall back to `/` ...; tested");
- `docs/design/accounts-screens/brief.md:86-87` ("(tested)").

**What is wrong.** The frontend has no test file of any kind `[V]`: `find` for `*.test.*`
outside `node_modules` found none, and `package.json` has no test script. The only checks were
manual, and they did not include dot segments. That is exactly the hole in finding 1.

**Fix.**
- Add `frontend/src/lib/next-path.test.ts`, run with `node --test src/lib/next-path.test.ts`.
  Node 25.9 strips types by default `[V]` (`node --version`), and `next-path.ts` imports
  nothing.
- Cases:
  - the brief's six;
  - every row of the table in finding 1;
  - `javascript:alert(1)`, `data:text/html,x`, `http://x@evil.com`, `" //evil.com"`,
    `/\u3000/x`;
  - a 10 000-character path.
- Add `"test"` to `package.json`.
- Until a test exists, the spec should not say "tested".

### 4. [should-fix] The logo link has no visible keyboard focus on /signup, /login, the feed and the project page

**Where:**
- `frontend/src/components/project/sections.tsx:42` (SiteHeader logo; it is the only header
  element on /signup and /login);
- `frontend/src/components/feed/feed.tsx:24` (feed logo).

**What is wrong.**
- Both use `outline-none focus-visible:outline-2 ... focus-visible:outline-primary` without
  `focus-visible:outline-solid`.
- `primaryButton`'s own comment (`parts.tsx:27-28`) explains the problem: Tailwind 4's
  `outline-none` sets the outline style to `none`, so no ring is drawn.
- Measured by Tab, 350 ms after each key press so the colour transition had ended `[V]`:
  - logo on /signup: `outline-style: none`;
  - logo on the feed, logged out and logged in: `outline-style: none`;
  - mockup logo: `solid 2px #4f46e5` (`auth.css:18`).
- Every new control has a solid 2px primary ring `[V]`: switch link, Show/Hide, submit, Log in,
  Sign up, Add project, avatar.

**Guideline.** ui-ux-pro-max "Focus States" (High): "Use a visible focus ring on every
interactive control ... Don't: outline-none without alternative".

**Why it matters.** A keyboard user's first Tab on the new pages lands on an element that shows
no focus.

**Fix.** Add `focus-visible:outline-solid` to both logo links.
- DEFERRED, outside this step: the same pattern exists in `parts.tsx:35` (`headerButton`),
  `editor-header.tsx:26, 74`, `feed.tsx:129`, `clamp-text.tsx:37`, `chips-field.tsx:83` and
  `tag-picker.tsx:66`.
- The feed's category tabs also measured `outline-style: none` `[V]`.

### 5. [should-fix] "Log out" shows keyboard focus only as a 1.09:1 background

**Where:** `frontend/src/components/account/account-menu.tsx:145` (`outline-none
hover:bg-page focus-visible:bg-page`).

**What is wrong.**
- The avatar was opened with Enter. The Popover moves focus to "Log out" (`popover.tsx:66`),
  and `:focus-visible` matches `[V]`.
- The only change is `background-color: rgb(245,245,250)` on a white panel. Contrast
  `#f5f5fa` against `#ffffff` is **1.09:1** `[V]` (Node, WCAG luminance formula).
- The mockup has the same rule (`auth.css:51`), but the mockup is not the bar.

**Guideline.** ui-ux-pro-max "Focus States" (High). WCAG 1.4.11 non-text contrast (3:1 for the
indicator) is my own reference.

**Why it matters.** A keyboard user cannot see that Log out is focused, which is the only item
in the menu.

**Fix.** Use the same ring as everything else:
`focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-solid
focus-visible:outline-primary`. The inset offset keeps the ring inside the 12px panel padding.
Keep `bg-page` for hover.

### 6. [should-fix] The server-side `/auth/me` forward can carry more cookies than `ph_session`

**Where:** `frontend/src/lib/server-api.ts:44-50`.

**What is wrong.**
- `cookies().get("ph_session").value` is URL-decoded by Next's parser
  (`node_modules/next/dist/compiled/@edge-runtime/cookies/index.js:60`, `decodeURIComponent`)
  `[V]`.
- That value is then interpolated raw into `Cookie: ph_session=${token}`.
- With the browser cookie `ph_session=zzz%3B%20ph_session%3D<real token>`, the feed rendered
  the logged-in group ("Account menu") `[V]`, via curl. So the API received two cookies from one
  value.
- A value with `%0D%0A` made `fetch` throw. The header then rendered nothing (state "unknown")
  `[V]`.
- Impact is low: the attacker has to plant the cookie in the victim's browser. But the brief
  states "only the login cookie is forwarded" (`brief.md:139`, `server-api.ts:40`), and that is
  not true for crafted values.

**Fix.** Forward only a value of the token's shape, and treat anything else as logged out
without a request:

```ts
if (!token || !/^[A-Za-z0-9_-]{20,128}$/.test(token)) return { state: "out" };
```

The token comes from `secrets.token_urlsafe(32)`, 43 characters `[A]`, so check the length in
`service.py`. Alternatively send `encodeURIComponent(token)`.

### 7. [should-fix] The username hint promises a profile address the server will refuse

**Where:** `frontend/src/components/account/auth-forms.tsx:198-205`.

**What is wrong.** The hint tests only the pattern, not the reserved list or the `taken` state.
- Typing `Admin` shows "Your profile: **/u/admin**" `[V]`. Pressing Sign up then says "This
  username is taken".
- After a 409 for `audit-one`: edit to `audit-onex`, then delete the `x`. The field shows
  "Your profile: /u/audit-one" with no error `[V]`.
  - Cause: `change` re-checks only while `shown[field]` is set (`auth-forms.tsx:160`), so
    `taken` is consulted again only on the next submit.
- The brief (`brief.md:13-15`) says the address is shown "once it is valid", and a reserved
  name is not valid.

**Why it matters.** The page tells the visitor their address is `/u/admin`, then contradicts
itself.

**Fix.**
- Derive the hint from `check(values).username === null` instead of `pattern.test`.
- Or re-check username and email on every change once `taken` holds a value for that field.
- One condition for both cases: `const usernameOk = !check(values).username`.

### 8. [nit] An invalid box turns grey on hover (mockup keeps it red)

**Where:** `frontend/src/components/ui/form.tsx:15-18`.

**What is wrong.** `hover:border-[#a9a7c0]` is in `box`, and the red border comes from a
non-hover class, so hover wins.
- After an empty submit, hovering Email measured `border-top-color: rgb(169,167,192)` in the
  app and `rgb(185,28,28)` in the mockup `[V]`.
- The mockup's equal-specificity rule order (`auth.css:82-83`) keeps it red.
- This is kit behaviour shared with /new.

**Fix.**
- `line(invalid)` returns `"border-danger hover:border-danger"` for invalid.

**Owner decision:** fix it in the kit, which also changes /new's hover on a "Missing" field
(recommended: yes, an error should not disappear under the pointer), or accept the deviation?

### 9. [nit] The Show/Hide focus ring sits at offset 0, not the mockup's 2px

**Where:** `auth-forms.tsx:77` (`focus-visible:outline-offset-0`).

**What is wrong.**
- Measured: app `outline-offset: 0px`, mockup `2px` (from the global `:focus-visible`) `[V]`.
- Offset 0 keeps the ring inside the 44px box, 4px from its border.

**Fix.** Keep offset 0 (it is the better choice inside a box) and note the deviation in the
brief, so the next mockup comparison does not flag it.

### 10. [nit] Tab out of the account menu leaves it open

**Where:** `frontend/src/components/ui/popover.tsx:47-71` (closes on Escape and on an outside
mousedown only).

**What is wrong.**
- Menu open by keyboard, focus on Log out. Tab moved focus to the "All" tab while
  `[role=dialog]` stayed in the DOM `[V]`.
- The open panel then covers the right end of the category bar.
- The component is reused "as it is" by decision (`brief.md:72-75`), so this is
  pre-existing behaviour.

**Fix.** Close on `focusout` when `relatedTarget` is outside `rootRef`. This is a one-place
change in Popover; check that it does not break the editor's choosers.

### 11. [nit] The double-submit guard reads React state, so two submits in one task both go out

**Where:** `auth-forms.tsx:165, 262` (`if (pending) return;`).

**What is wrong.**
- A real double-click sent **1** POST and Enter twice sent **1** POST `[V]`.
- `form.requestSubmit(); form.requestSubmit();` in one task sent **2** `[V]`: both handlers ran
  before React re-rendered with `pending = true`.
- This only matters for scripts or extensions, not people.

**Guideline.** ui-ux-pro-max "Loading Buttons" (High).

**Fix.** Use a `useRef(false)` flag, set synchronously at the top of `submit` and cleared in
`catch`. Keep `pending` for rendering.

### 12. [nit] The avatar initial breaks on names that start with an emoji or another astral character

**Where:** `account-menu.tsx:131` (`name.trim().charAt(0)`).

**What is wrong.** `"😀x".charAt(0)` is `"\ud83d"`, a lone surrogate, which draws a replacement
glyph `[V]` (Node). The display name allows any character (`schemas.py:47`).

**Fix.** `Array.from(name.trim())[0]?.toUpperCase()`.

### 13. [nit] Unmapped 4xx answers are shown verbatim, and some are jargon

**Where:** `auth-forms.tsx:23-32` (`readFailure`, the final `return { message: error.message }`).

**What is wrong.** A 403 from the Origin check would show "Requests must come from the site"
above the button `[D]`. That rests on two facts:
- curl with `Origin: http://127.0.0.1:3000` returned that text `[V]` (`main.py:48`);
- a routed 403 with a substituted body was rendered verbatim in the alert `[V]`.
- This happens to anyone who opens the site from another host name (for example a Vercel
  preview URL or `127.0.0.1`), since `SITE_ORIGIN` is exact.

**Fix.** Map `origin_not_allowed` and any unknown code to one plain line, e.g. "Something went
wrong. Reload the page and try again.". Keep the server text for 401 and 429, whose wording was
designed.

### 14. [nit] A failed logout gives no feedback

**Where:** `account-menu.tsx:94-104`.

**What is wrong.** Any failure (offline, 403, 5xx) is swallowed and the page reloads. The person
sees the same logged-in header and no message `[D]`. While waiting there is also no visible
state: only `aria-disabled`.

**Fix.**
- On a non-network failure, keep the menu open with one line "Could not log out. Try again.".
- Show "Logging out..." in the item while `leaving`.

### 15. [nit] The logged-in redirect from /login and /signup is a 200 page with a client redirect

**Where:** `app/login/page.tsx:25`, `app/signup/page.tsx:27` (`redirect` inside `<Suspense>`).

**What is wrong.**
- Measured `[V]` (curl): the response is `HTTP/1.1 200 OK` with the static shell (h1 "Log in")
  plus `NEXT_REDIRECT;replace;...;307` and `<meta http-equiv="refresh" content="1;url=...">`.
- Playwright landed on the target after about 490 ms `[V]`.
- Without JavaScript the meta refresh waits 1 s. This is a consequence of cacheComponents
  (cookies are read inside Suspense), not a bug.

**Fix.** Accept, or redirect in `proxy.ts` (Next 16) when `ph_session` is present. That checks
only presence, so a stale cookie would bounce; that is why I recommend accepting it.

### 16. [nit] The header's Log in and Sign up drop the visitor's place

**Where:** `account-nav.tsx:61-66` (plain `/login`, `/signup`).

**What is wrong.** A visitor on `/projects/reflex` who logs in from the header lands on the feed,
not back on the project `[D]` (`safeNext(undefined)` gives `/`). The `next` machinery exists but
the header does not use it.

**Owner decision:** should the header links return the visitor to the page they were on?
(Recommended: yes on the project page. Pass `next` from `ProjectPage` into
`<AccountNav next={...} />` and build the links with `withNext`. The feed can keep the plain
links.)

### 17. [nit] Code quality: small duplication and leftovers

The duplication at the cited `path:line` is `[V]`. The behaviour claims are `[D]` from reading
the code, except the `safeNext` point, which my login run verified.

- **`FormCard` re-types the `card` constant.** `auth-forms.tsx:113` has
  `rounded-[16px] border border-line bg-card`, which is `parts.tsx:26` `card`. Use `${card}`.
- **`SubmitButton` copies `primaryButton`'s colour, shadow and focus strings.**
  `auth-forms.tsx:103` repeats `parts.tsx:29-32` (only height, width, radius and text size
  differ). The shadow literal now appears in three places. Extract the shared part or compose
  from `primaryButton` with overrides.
- **`safeNext` runs twice for one value.** It runs on the server (`page.tsx`) and again in the
  form (`auth-forms.tsx:173, 270`). After finding 1 is fixed, drop the client call and type
  `next` as an already-safe path. Today the second call is what saves the post-login path, which
  shows that nobody relied on it on purpose.
- **`FormAlert`'s `key={attempt}` is redundant.** `submit` already clears the alert with
  `setAlert(null)` and re-renders through `setPending(true)` before the answer arrives. Either
  remove the key and the `attempt` state, or keep one mechanism and say which.
- **The pattern is rebuilt on every render.** `new RegExp(rules.pattern)` (`auth-forms.tsx:131`)
  runs on every keystroke. `useMemo`, or build it once in the page and pass it down.
- **Raw hex.** `#cfcbf6` in `account-menu.tsx:123` (open ring). It is copied from the mockup
  and is not a token.
- **Stray blank line.** `backend/tests/test_catalog.py:29` adds a blank line inside an
  unrelated test.

### 18. [nit] Slow API: the auth pages show only the title, with no sign of loading

**Where:** `app/signup/page.tsx:12-14`, `app/login/page.tsx:12-14` (`<Suspense fallback={null}>`);
`server-api.ts` `fetch` calls have no timeout.

**What is wrong.** `/auth/me` and `/catalog` are awaited before the form renders. If the API
answers slowly, the visitor sees "Sign up" and an empty column `[D]`. The same pattern exists
elsewhere; this is the first page where the whole purpose waits on it.

**Fix.** A fallback that draws the card outline at its final height (no layout shift), and an
`AbortSignal.timeout(5000)` on `getAccount`, which already maps failures to "unknown".

---

## Checked and fine

**Geometry, type and colour against the mockups**, element by element, at 1440 and 1920
`[V]`:
- Elements compared: header, logo, h1, switch line and link, card, labels, inputs, hints and
  messages, Show/Hide, alert and icon, submit, spinner.
- Pages: /signup and /login.
- States I compared myself: empty, filled, page check (errors), offline, loading, and login
  check, 401 and 429. I did not compare 409 taken against `signup.html#taken`; main session
  verified it, and I did not re-check it.
- Every box matched to 0.1 px, with identical font size, line height, weight and colours. The
  only differences were not visible:
  - the `label` element width (block vs inline);
  - Show/Hide line height 20 vs 19.5 inside a 36px flex button;
  - Tailwind's composed `box-shadow` string versus the mockup's single shadow (same visible
    shadow);
  - hover and focus side effects of the pointer position.
- Card 400px at 1440 and 464px at 1920 (padding 24 to 32), column centred.

**Header group** against `header-states.html`, feed logged out and logged in with the menu open,
at 1440 and 1920 `[V]`:
- Log in 40px quiet, Sign up and Add project 40px primary, avatar 40x40 with a 36px circle.
- Menu 240px, right-aligned, name 15/22.5 600 and @handle 13/20 muted. The 1920 values scale
  the same way.
- The search box stays at x=440 (1440) and x=680 (1920) with or without the group.

**Focus rings** (solid 2px `#4f46e5`, offset 2px) `[V]` on: switch links, submit buttons, Log
in, Sign up, Add project, avatar. Inputs show an indigo border plus the 3px halo, and focus wins
over red, as the brief says.

**Behaviour** `[V]`:
- Empty submit: all four messages at once, with the brief's text; focus on Name;
  `aria-invalid` set and `aria-describedby` pointing to `*-message`; no live role (announce off),
  so focus reads the message.
- Re-check as you type: the message updates and then clears; the hint returns and
  `aria-describedby` switches to `*-hint`.
- Show/Hide: `type` toggles; `aria-label` reads "Show password" / "Hide password"; the width
  stays 64px in both states; focus stays on the button.
- 409 username and 409 email (the second with `AUDIT1@example.com ` written in upper case with a
  trailing space): the message goes under the right field, focus moves there, and no alert
  appears.
- 401: "Wrong email or password" in the alert. A repeat replaces it (one alert in the DOM).
- 10 wrong passwords, then the 11th answers "Too many failed logins. Try again in a few
  minutes."
- Network failure and 502: the offline message. Loading: spinner, "Signing up...",
  `aria-busy`, `aria-disabled`.
- A real double-click or a double Enter sends one POST.
- `next` kept by both switch links (`/signup?next=%2Fprojects%2Freflex%3Fx%3D1`,
  `/login?next=%2Fnew`).
- Login with `next=/new` landed on `/new`. A logged-in `/signup?next=/?q=abc` landed on
  `/?q=abc`.
- Logout from the menu: full reload, header shows "Log in / Sign up", cookie gone, `/auth/me`
  answers 401. Escape closes the menu and returns focus to the avatar.
- Feed empty state, logged out: "Add project" links to `/signup?next=%2Fnew`.
- Rendered input attributes match brief item 5: name and nickname autocomplete, `type=email`
  with `autocomplete=username`, new-password and current-password; `autocapitalize=none` and
  `spellcheck=false` on the username; no placeholders; paste not blocked.
- Backend: the catalog serves `username_rules`, and its pattern is the one `schemas.py`
  compiles. The JavaScript and Python regexes agree, because both sides trim before testing, so
  Python's `$`-before-newline never applies `[D]`.

**Security** `[V]`:
- `ph_session` is `HttpOnly`, `SameSite=Lax`, `Path=/` (Set-Cookie seen by curl).
  `document.cookie` was `""` after login.
- Email, user id and token do not appear in the HTML or RSC payload of `/`, `/projects/reflex`,
  `/login` or `/signup` while logged in (grep for each, count 0).
- `AccountMenu` receives only name, username and avatar.
- The server never forwards cookies on `fetchCatalog`, `fetchFeed` or `fetchPublishedProject`
  (`server-api.ts:9-14`) `[D]`.
- These inputs all fall back to `/` (Node table in finding 1): `javascript:`, `data:`,
  `http://x@evil.com`, protocol-relative, tab, newline and leading space.
- Plain backslash inputs also fall back to `/` (live table in finding 1). Backslash combined with
  a dot segment does not; that is finding 1.
- Unicode slashes stay percent-encoded on this site.

**`/auth/me` failing with something other than 401** `[D]` (I could not cause it without
stopping the API):
- `getAccount` returns "unknown" for any non-200/401 status, a thrown `fetch`, or bad JSON.
- `AccountNav` then renders nothing; the feed grid keeps the search centred.
- The sign-up and login pages still show the form.
- The feed empty state gives `/new`. That is acceptable, because the step-3 guard will send a
  visitor to login.
- A header-injection attempt (`%0D%0A`) also lands in "unknown" `[V]`.

**/new is unchanged** `[V]`:
- No call site outside `components/account` passes `hint`, `announce`, `hintId`, `end` or a
  browser hint (grep).
- On the rendered /new, the inputs have no `name`, `autocomplete`, `spellcheck`,
  `autocapitalize` or `aria-describedby`; padding is `pl-[14px] pr-[14px]` (and `pl-[44px]` on
  the repo field); there are no `*-hint` nodes; and the header has no account group.
- `Field` keeps `role="status"` by default (`announce = true`), and the class strings of
  `TextField` without `end` are character-identical to before (diff) `[D]`.

**Contrast** `[V]`:
- `#b91c1c` on `#fdf2f2` is 5.90:1, and on white 6.47:1.
- Hint `#5b5a74` on white is 6.65:1.
- Link `#4338ca` on the page background is 7.27:1.

**Verified by main session, not re-checked by me:**
- backend 90 tests and ruff;
- `tsc`, `eslint` and `next build`;
- the browser runs of the brief's `next` cases;
- header group widths of 153 and 180px.

**Not checked:**
- Focus rings at 1920. The Tab walk ran at 1440 only. The ring classes do not depend on the
  breakpoint `[D]`.
- The project page header with a real project: the database has no projects, and
  `/projects/reflex` renders Next's bare 404. It uses the same `AccountNav` and the same
  `SiteHeader` as the auth pages, so it is `[D]` only.
- Phone layout (out of scope).
- Screen-reader output itself; only the ARIA attributes were checked.

## Resolution (main session, 2026-11-27)

- 1 FIXED: `safeNext` refuses a cleaned path that starts with `//`. `frontend/src/lib/next-path.test.mjs`
  (`npm test`, Node's own runner) covers every input above; 2 of its 4 tests fail on the old
  function, all 4 pass now. Live, logged in: the four reported `next` values on /login and /signup
  all land on `localhost:3000/`.
- 2 FIXED: the form has `method="post"`. Live with script chunks blocked: Enter sends POST /login, the
  password is not in any URL.
- 3 FIXED by the test file above.
- 4 FIXED for the logo on the feed and site headers (`outline-solid`); the other files stay DEFERRED.
- 5 FIXED: Log out gets the 2px primary ring inside its box.
- 6 FIXED: `getAccount` forwards only a value matching `^[A-Za-z0-9_-]{20,128}$`.
- 7 FIXED: the profile address shows only for a valid, not reserved, not taken name.
- Nits fixed: instant double-submit guard (a ref), the avatar initial takes a whole character, the
  alert key at the call site, the form card uses `card`.
- Nits left as they are (recorded, not acted on): invalid box turns grey on hover (form-kit
  behaviour, changing it changes /new); Show/Hide ring offset 0 (kept); Tab out of the account menu
  leaves it open (shared Popover, DEFERRED); 403 wording; no logout error message; logged-in
  redirect is a 200 page plus a browser redirect (known Next behaviour inside Suspense); header
  links do not return to the visitor's page (product question for later); no loading sign on a
  slow API; the inherited `#cfcbf6` ring colour.
- The 401 for next2@example.com: the main session ran the backend tests in between, which empty
  the test database.
