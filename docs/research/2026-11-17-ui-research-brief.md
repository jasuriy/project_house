# UI research brief - competitor design study (2026-11-17)

Status: brief written before any browsing. Findings go to `2026-11-17-ui-research-findings.md`.
Third-party screenshots stay outside the repo (local scratch folder); only text findings with
source URLs are committed.

## Question

How do comparable platforms present (1) a single project, (2) a person's profile, (3) a feed or
discovery page, (4) the "add a project" flow, (5) messaging - and which of those patterns let a
recruiter judge one project in under a minute, on a phone?

## Fixed by the spec (not up for research)

- Fixed project card fields (spec section 8): title, one-line problem, short description, result,
  demo video embed or images, tech stack, field, GitHub link, license, author's role.
- Two account types (developer, company person). Feed = newest first + filter by field (D7).
  DMs with Requests (D8, D9). Public pages, no login to view.
- Shareable link `<domain>/<username>/<project>` with no language prefix (D17), and a good
  Telegram preview card (D5).
- Interface languages: Uzbek (Latin), Russian, English (D10).

## Method

- Sites: Behance, Dribbble, Devpost, Product Hunt, Peerlist, Arduino Project Hub,
  Hugging Face Spaces, GitHub repository page (the baseline every developer already has),
  plus LinkedIn / Instagram only where public pages exist.
- Pages per site: project detail page, a profile, the discovery/feed page.
- Logged-out public pages only. Never sign in with any personal account.
- Two fixed viewports: desktop 1440x900, mobile 390x844. Full-page screenshot plus the first
  screen (what a visitor sees before scrolling).
- For each project page, also record the share-preview tags: `og:image`, `og:title`,
  `og:description`.
- Per screenshot, a short factual note: layout; what is above the fold on mobile; where the demo,
  tech stack, author and the contact/follow button sit; card anatomy on feed pages.
- Login walls / bot protection: at most two attempts per site, then log as "blocked".

## Controls

- Same viewports and logged-out state for every site.
- GitHub repo page is the baseline: any pattern we adopt must explain a project faster than a
  README does.

## Decision rule

A pattern is adopted only if it serves at least one of:
1. the fixed project card (judge one project in under a minute),
2. ~~mobile-first use~~ desktop-first use, with the phone layout designed last
   (corrected by Bek 2026-11-17, spec D18: the product is mainly a website),
3. the Telegram share preview.
Everything else is noted, not adopted.

## Constraints on the visual direction (checked before any direction is shown)

- Typefaces must cover Latin, Cyrillic and Uzbek characters (o'/g' with U+02BB modifier letter
  turned comma). Many display fonts fail one of these.
- Accessibility: text contrast at least 4.5:1, touch targets at least 44x44 px.
- The ui-ux-pro-max skill is used later for palettes, font pairing and accessibility checks on a
  direction Bek has chosen - not to pick the direction.

## Output and stopping point

Findings file (committed) + a short visual summary page for Bek + 2-3 design directions to choose
from. No mockups in this phase; Bek picks a direction first.
