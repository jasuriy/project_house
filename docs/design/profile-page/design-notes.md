# Profile page `/u/<username>`: design notes (desktop 1440)

Design only. No app code was changed. Files in this folder:

| File | What it shows |
|---|---|
| `profile.html`, `profile-1440.png`, `profile-1440-full.png` | A user with 6 projects, as a visitor sees it |
| `profile-empty.html`, `profile-empty-1440.png` | A user with no projects, no photo and no GitHub link: the owner's view |
| `profile-empty.html#visitor`, `profile-empty-visitor-1440.png` | The same user, as everyone else sees it |
| `profile-long.html`, `profile-long-1440.png` | Long content: a 60-character display name, a 30-character username and GitHub login, no photo |
| `poster-*.jpg`, `author.jpg` | The two live posters and the author photo (the signed poster links expire after an hour, so these are saved copies) |

Sample data: GPT Researcher and Reflex use their live text, stack and poster. Tezkor, Defect Lens, Kassa and Dars Planner are made up. They have no poster, so they show the feed's own no-poster frame. Their labels come from `backend/app/catalog.py` and their stacks stay within D26. The GitHub login is `jasuriy`, the real repository owner.

## Layout and why

```
[ header: logo | search | Add project ]           today's feed header (a placeholder, see below)
  Back                                             D33 link, unchanged
  (photo)  Jasurbek                                name = the page's h1, 40px (title size)
           @jasurbek                               17px, muted
           [gh] jasuriy ->    [cal] Joined Mar 2026
  ------------------------------------------------ one line, as under the feed's tabs
  [card] [card] [card] [card]                      the feed grid: 4 columns at 1440
  [card] [card]
```

- **The work is the hero.** The person's part is a short band, so the first row of cards is fully on screen at 1440x900. On Instagram the posts are the profile, and the same idea fits here.
- **No card around the profile part, no cover banner.** There is no data to put in a banner. A white card around four lines would just be a box. The band sits on the page background, like the feed's tab row.
- **Left-aligned on the 48px line, full width.** The photo's ring, the divider and the first card all start at x=48, in line with the logo. The grid's right edge lines up with the Add project button.
- **Only two facts, each with an icon:** the GitHub link and the join date. They are separate items, not a dotted meta string. Nothing else is in the data, so nothing else is shown.
- **Headings:** the name is the h1, a screen-reader-only h2 "Projects" comes next (as the feed has a screen-reader-only h1), and the card names are h3. No level is skipped.
- **Dates use short months everywhere:** "Joined Mar 2026" in the profile band, "Nov 26, 2026" on the cards. This matches "Aug 2026" on the project page.
- **Long names:** the name wraps onto even lines (`text-wrap: balance`), at a space or a hyphen. The handle and the facts move down with it.

## The header is a placeholder

The page shows today's header exactly as it is. Its logged-out state (Log in / Sign up) and logged-in state (avatar menu) are designed in accounts step 2. This page does not depend on how they look.

## What it reuses

| Part | Source | Change |
|---|---|---|
| Header | `FeedHeader` (feed.tsx) | none (placeholder, see above) |
| Back | `BackLink` (back-link.tsx) | none visible. Its logic may need extending (question 2) |
| Grid | feed `page.tsx`: `auto-fill minmax(320px, 1fr)`, gap `--gc` | none |
| Card | `ProjectCardView` | name becomes h3. The footer shows the published date instead of the author. Like and Save stay. The card needs two new props: heading level and footer kind |
| Stack line | `StackLine` | none (the mockup runs the same fit-and-"+N" code) |
| Preview video | `FeedVideo` | none. It autoplays as in the feed (D34). The mockup shows posters only, because the preview links expire |
| Photo ring | `Byline` ring (2px page, 4px #cfcbf6) | scaled to 96px |
| No-photo fallback | `TechIcon` letter badge | first letter of the display name, `--color-badge` background with `--color-primary-ink` text, 40px |
| Empty state | `FeedEmpty` box | new copy. The visitor's link is body size (15px), the same weight as Back |
| Type sizes | 13 / 15 / 17 / 40 only | none new |

## Owner and visitor

- **With projects: the same page for both.** Owners see exactly what visitors see. Add project is already in the header. No owner-only buttons.
- **No projects, owner:** "No projects yet. Add your first one: a demo video, the story and the stack on one page. It shows here and in the feed." with an **Add project** button, as in `FeedEmpty`.
- **No projects, visitor:** "No projects yet. When Dilnoza Karimova publishes a project, it shows here." with a **See all projects** link to the feed. The copy uses the full display name, because guessing a first name goes wrong for many names.
- **No photo:** only GitHub sign-up sets a photo (accounts spec), so every email-and-password account starts with the letter. It is the common case, not an edge case.

## Measured in the browser (Playwright, Chromium, viewport 1440x900, after `document.fonts.ready`)

- [V] On all four views: font sizes are 13, 15, 17 and 40 px (Golos Text), nothing under 13; no sideways scroll (`scrollWidth == clientWidth`); headings h1, h2 (screen-reader only), then h3 on the pages with cards.
- [V] Left edges at 48.0: logo, Back, the photo ring's outer edge, the divider and the first card. The divider's right edge is at `clientWidth - 48`, the same as the header button.
- [V] Long variant: the 60-character name takes 2 lines (708 px and 580 px wide); the facts do not overlap each other or the name; the first row of cards still ends at y=731, on screen.
- [V] 6-project page: 4 columns, first row ends at y=689.
- [V] Card parts match the live feed card exactly (body 171.97, footer 52.51, title 22.09 px).
- [V] The visitor's "See all projects" link: 15px, weight 500, the same as Back.
- Smallest targets: Back and the GitHub link are 32px high, the Like/Save buttons 36px, as on the live pages. The phone design will give them 44px.

## Decided

- No "Works with" row: it needs data we do not have yet.
- The card footer on the profile shows the published date.

## Answered by Bek (2026-11-27)

1. **No project count** in the profile band. The cards already show how many there are, as in the feed (commit 8885c3a).
2. **Back also steps back to a project page** when the visitor came from one (extends D33).
3. **The author on feed cards and the project page byline links to the profile.** This changes two shipped pages.

The design is approved. It is built after accounts step 3 (real accounts and ownership).

## Later

- Like and Save on your own cards: keep one identical card until liking works.
- Owner tools (edit profile, edit or delete a project) when those features exist, at the right end of the profile band.
- Photo upload, so an email-and-password account can replace the letter.
- New fields: a one-line bio first, then links and pinned projects.
- Category tabs on the profile, once profiles have many projects.

## Build plan (2026-11-27, after accounts step 3)

Backend:
1. `GET /api/v1/users/{username}` -> `{ user: { username, display_name, avatar_url, github_login,
   joined }, projects: [ProjectCard...] }`, where `joined` is the month only ("2026-03"): the page
   shows "Joined Mar 2026", so the exact moment someone signed up is not made public; the person's projects newest first (at most 96, the
   feed's limit). Unknown username: 404 `user_not_found`. The username is looked up lowercased. No
   email, no id. `list_published` gets an owner filter, so cards come from the same code as the feed.
2. Tests: profile with projects (only that owner's, newest first), unknown user 404, no email in the
   answer, an upper-case address finds the same person.

Frontend:
3. `/u/[username]` (server, the reading part inside Suspense): the feed header with the account
   group, Back, the profile band (96px avatar or letter, name as h1 40px, @username 17px, GitHub link
   when there is one, "Joined Mon YYYY"), a line, a screen-reader-only h2 "Projects", then the feed
   grid; the empty states for owner and visitor as designed. Unknown username: the 404 page.
4. `ProjectCardView` gets two options: heading level (h2 in the feed, h3 on the profile) and footer
   (the author in the feed, the published date "Nov 26, 2026" on the profile). Dates are formatted
   on the server in English, UTC.
5. Links to the profile (answer 3): the author's name in the feed card footer; the name in the
   project page byline (not on the upload page, where leaving empties the form, D24); the name block
   at the top of the account menu (no separate "Your profile" item).
6. Back (answer 2, extends D33): it steps back only when the page before is a page to read: the
   feed (`/`), a project (`/projects/<x>`) or a profile (`/u/<x>`). The list names what is allowed,
   so a page added later never becomes a Back target by accident; otherwise Back is a link to the
   feed. Used on the project page and the profile page.
7. `Avatar` gets the 96px size (letter at the title size).

Verification: ruff, pytest, tsc, eslint, `npm test`, `next build`; local run on the test database:
the band and grid against `profile.html`, `profile-empty.html` (owner and `#visitor`) and
`profile-long.html` at 1440 and 1920; the links (card author, byline, menu); Back from a project
page and from the feed; an unknown username. Then the inspector (only what is new), the advisor,
Bek. Deploy: Modal deploy first (new endpoint), check it answers, then push.
