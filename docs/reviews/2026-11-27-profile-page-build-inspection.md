# Profile page build inspection (2026-11-27)

Scope: only the uncommitted profile-page diff (`git diff` + `frontend/src/app/u/`, `frontend/src/components/profile/`).
I read the code and ran three read-only GET requests. Nothing was edited, nothing was submitted.
Not re-checked, because the main session already verified them: geometry against the mockups at 1440/1920, the 404 behaviour, the author/byline/menu links, the Back paths it listed, and the tests/lint/tsc.

Tags: `[V]` verified (read at `path:line` or observed), `[D]` derived, `[A]` assumed, `[U]` unknown.

## Summary

No blockers. Three should-fix: (1) the Back rule now uses a deny-list, so it fails open, (2) mixed-case profile addresses are served as duplicate pages, (3) the API returns the exact sign-up timestamp although the page only shows the month. The rest are nits.

## Findings

### 1. [should-fix] The Back rule fails open: every route not on the deny-list counts as a page to read

- `frontend/src/components/project/back-link.tsx:16` `const NOT_BACK_TARGETS = ["/new", "/login", "/signup"];` and `:29` returns `previous.key` for **any other** pathname [V].
- Before this diff the rule was an allow-list (`pathname === "/"`, see the removed line in the diff) [V]. Now any future route (settings, an edit page, a logout landing page, a 404 page) automatically becomes a Back target until someone remembers to add it to this list [D]. The app's route set today is `/`, `/login`, `/new`, `/projects/[slug]`, `/signup`, `/u/[username]` [V: `find frontend/src/app -name page.tsx`], so today's behaviour is correct [D]. The weak point is the next route somebody adds.
- A 404 page is already a reachable Back target today. Example: an address with a typo (404) followed by a client navigation to a profile or project. It is rare, because the default 404 has no links [U: depends on whether the root layout renders links on the 404 page].
- Fix: turn it into an allow-list of reading pages, the same shape as the old rule:
  `const isReadingPage = (p: string) => p === "/" || p.startsWith("/projects/") || p.startsWith("/u/");`
  Then delete `NOT_BACK_TARGETS` and rewrite the comment at `:14-15` to match.

### 2. [should-fix] `/u/JasurBek` and `/u/jasurbek` are two addresses for one profile, with no redirect

- `frontend/src/app/u/[username]/page.tsx:28` tests `username.toLowerCase()` against the pattern, but `:29` passes the **original-case** `username` to `fetchProfile` [V]. `backend/app/projects/service.py` `get_profile` then runs `User.username == username.lower()` [V]. Any mix of upper and lower case therefore renders the same profile at a different address [D]. A live check was not possible: the locally running API answered `user_not_found` even for `jasurbek` (`curl http://127.0.0.1:8000/api/v1/users/jasurbek`), so the seeded data is not what the local servers see right now [V]. I did not chase this further (out of scope).
- Effect: duplicate URLs get shared and indexed, and the owner check at `:32` compares lowercase to lowercase, so it still works [D].
- Fix: in `ProfileView`, after the pattern check, `if (username !== username.toLowerCase()) redirect(`/u/${username.toLowerCase()}`)` (`permanentRedirect` from `next/navigation`). Do the same for the case where the backend lower-cases, or let the backend reject non-lowercase input. Pick one canonical form.

### 3. [should-fix] The public profile API returns the full `created_at` timestamp; the page needs only the month

- `backend/app/projects/schemas.py` `ProfileUser.created_at: datetime` is serialised at full precision from `User.created_at` (`backend/app/accounts/models.py:26`) [V]. The UI shows only `Joined {monthYear(...)}` (`frontend/src/components/profile/profile-head.tsx:42`) [V].
- Effect: anyone can read the exact second each account was created. That is more than the person chose to show, and it can be used to link accounts made together [D]. Small, but this endpoint is public and exists to hold "public fields only" (the schema's own docstring) [V].
- Fix: expose only `joined: str` as `"YYYY-MM"`, or truncate to the first day of the month in the schema (a `field_serializer`), and keep the frontend's `monthYear` as it is.
- Owner decision: is the exact sign-up time public data? Recommended: no, send the month only.

### 4. [nit] `github_login` is pasted into the href without encoding

- `profile-head.tsx:27` `href={`https://github.com/${user.github_login}`}` [V]. The scheme and host are fixed, so this cannot redirect to another site and cannot become a `javascript:` link [D]. Today nothing writes `github_login`: it appears only in the model and in the output schemas (`grep -rn github_login backend/app`) [V]. It will be set by GitHub login (step 4), and GitHub logins are `[A-Za-z0-9-]` [A]. If a value with `/`, `?` or `#` ever arrives, the link points to the wrong GitHub page [D].
- Fix: `https://github.com/${encodeURIComponent(user.github_login)}`, and validate `^[A-Za-z0-9-]{1,39}$` where step 4 writes it.

### 5. [nit] Unknown profiles return HTTP 200, not 404 (soft 404)

- `curl -w %{http_code} http://localhost:3000/u/zzz-nobody` gives `200` with the "could not be found" page and a `noindex` meta [V]. `notFound()` runs inside the `Suspense` boundary (`page.tsx:17-18`, `:28`, `:30`) after the shell has already been streamed, so the status cannot change any more [D]. The project page uses the same pattern (`projects/[slug]/page.tsx`) [V], so this was not introduced here; the profile page copies it.
- Effect: crawlers and link checkers see a successful page (the `noindex` softens this) [D].
- Fix (optional, applies to both pages): validate and fetch before the Suspense boundary, or accept it and record it as known.

### 6. [nit] The 96-project cap is a duplicated magic number and cuts silently

- `service.py` `PROFILE_LIMIT = 96  # the feed's own maximum` duplicates `router.py:79` `Query(ge=1, le=96)` [V]. A person with more than 96 projects loses the oldest without any sign [D].
- Fix: one shared constant (`FEED_MAX = 96`) used in both places. Accept the cut for now, and record it in the design notes as deferred pagination.

### 7. [nit] Projects heading: the list is announced twice

- `page.tsx:46` `<h2 className="sr-only">Projects</h2>`, then `:50` `<ul aria-label={`Projects by ${user.display_name}`}>` [V]. A screen reader says "Projects, heading" and then "Projects by Dilnoza, list" [D].
- Fix: keep one. Recommended: keep the h2 (it gives the h1 > h2 > h3 outline that was verified) and link the list to it with `aria-labelledby` and an id on the h2. Drop the separate `aria-label`.

### 8. [nit] The card footer date is a plain `<p>`, not a `<time>`

- `frontend/src/components/feed/feed.tsx` footer branch `<p className="text-cap text-muted">{fullDate(project.published_at)}</p>` [V].
- Fix: `<time dateTime={project.published_at} className="text-cap text-muted">...</time>`. It is machine-readable and costs nothing visually.

### 9. [nit] Duplicated date formatting in `lib/catalog.ts`

- The new `monthYear` (`catalog.ts:37`) is `MONTH.format(new Date(iso))`, and `timeline` (`:43-44`) still writes `MONTH.format(new Date(...))` twice by hand [V].
- Fix: use `monthYear(project.started_on)` and `monthYear(project.finished_on)` in `timeline`.

### 10. [nit] Account-menu name link: rounded corners on a bottom border

- `frontend/src/components/account/account-menu.tsx` Link class: `rounded-[8px] border-b border-line ... hover:bg-page` [V]. A border radius with only a bottom border curves the divider's ends upward, and the hover fill covers the divider [D]. I did not take a screenshot [U: cheapest check is to hover it at 1440].
- Fix: move the divider outside the link (wrap it in a `div` with `border-b pb-[8px] mb-[8px]` and give the Link `rounded-[8px] px-[10px] py-[6px]`), so the hover pill and the divider are separate.

## Checked and fine

- Privacy: `ProfileUser` extends `Owner` (username, display_name, avatar_url) and adds github_login and created_at. No email, no id (`schemas.py:125-132`, plus the new class) [V]. created_at precision is covered in finding 3.
- Username/path handling: `Path(max_length=30)` plus frontend pattern `^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$` (anchored, `catalog.py:178`) plus `encodeURIComponent` in `fetchProfile`. No injection or traversal into the API path [V]. The `/u/${username}` hrefs come from regex-restricted usernames [D].
- Backend query: `owner_id` filter, newest first. Every project row has `published_at` (non-null, `models.py:23`), so no drafts leak [V].
- Open redirect: none. Every new link is site-relative or fixed to `https://github.com/` [V].
- Accessibility: Avatar is `aria-hidden` with `alt=""`, so the author link name is the display name, said once [V]. The GitHub `aria-label` contains the visible text (label-in-name) and adds the new-tab warning [V]. Focus rings on the new links use the `outline-solid` pattern [V].
- Byline `link` prop is off on the upload page (D24 rule) and on for the project page [V]. `fetchProfile` mirrors `fetchPublishedProject` [V].

## Resolution (main session, 2026-11-27)

- 1 FIXED: Back names the pages it may return to (`/`, `/projects/<x>`, `/u/<x>`). Live: profile ->
  project -> Back = profile; feed -> profile -> Back = feed; after sign-up -> Back = link to feed.
- 2 FIXED: `/u/JasurBek` permanently redirects to `/u/jasurbek` (live).
- 3 FIXED: the API sends `joined` ("2026-03") instead of the sign-up moment; test checks the shape.
  (Found on the way: the frontend must deploy after the backend, since the page reads `joined`.)
- 4 FIXED (encodeURIComponent), 7 FIXED (list has no aria-label; the h2 names it), 8 FIXED (`<time>`),
  9 FIXED (timeline uses monthYear), 10 FIXED (divider on a wrapper, straight).
- 5 DEFERRED (inherited from the project page: notFound inside Suspense answers 200, page is noindex).
  The same holds for the upper-case redirect: inside Suspense, `permanentRedirect` sends the browser
  to the lowercase address, but the response is not a real 308 status.
- 6 left: the feed's limit is a query bound, the profile's a constant; no "more" sign yet.
- The "jasurbek not found" seen during the review: the backend tests had just emptied the test
  database; it was reseeded right after.
