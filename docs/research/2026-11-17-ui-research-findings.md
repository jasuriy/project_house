# UI research findings - competitor design study (2026-11-17)

Brief: `2026-11-17-ui-research-brief.md`. Method: logged-out public pages, desktop 1440x900 and
mobile 390x844, project / profile / discover pages, share tags read from the DOM.
Screenshots (108, third-party, kept local only, not in git): `.playwright-mcp/design-shots/`.
Per-site factual notes were written by capture agents (Sonnet); the key first-screen screenshots
(project pages on mobile and desktop, discover pages) were viewed directly by the reviewer.

Coverage: captured - Devpost, Hugging Face Spaces, Arduino Project Hub, GitHub, Peerlist,
Behance, Product Hunt, Instagram (public profile). Partial - Dribbble (human-verification wall on
direct URLs; reached via in-site clicks, share tags unreadable). Blocked - LinkedIn (auth wall).

## 1. The gap: nobody shows "can I judge this project?" on the first phone screen

What a visitor sees on the first mobile screen of a project page (390x844):

| Site | First mobile screen | Demo | Tech stack | Author + contact |
|---|---|---|---|---|
| Devpost | title, tagline, Like 8374 / Comment 7827 buttons, tabs | carousel starts mid-screen | at the END of a long story (y ~3148 of 5911 px) | author near the bottom; no contact |
| Arduino | author card, 4-line title, meta, floating like bar | starts at the fold | below the fold ("Devices & Components") | author first; Follow only |
| Peerlist | app logo, name, tagline, author chip, Visit / Upvote | small thumbnails, below fold | "Built with" below fold | author chip; no message on project page |
| Product Hunt | logo, name, rating, Visit website, categories | carousel below fold | none (categories only) | maker far below; no contact |
| Behance | title row, cover image | the work itself (images) | at the very end of the page | Message in desktop rail only |
| Dribbble | title, author, like / save, "Get in touch" | full-width image | none | author + Get in touch ABOVE the image |
| GitHub | breadcrumb, About text, 17 topic chips | none (inside README, below file list) | topic chips | owner name only; no contact |
| Hugging Face | breadcrumb, title, description | the live app IS the page (empty until used) | none | breadcrumb only; no contact |

**Finding:** none of the eight puts demo + problem + result + tech + author + contact together on
the first screen. Each optimises for something else (story, upvotes, the artwork, the code).
A recruiter judging "is this person good?" has to scroll and hunt on every one of them.

## 2. Patterns, judged against the decision rule

Decision rule (brief): adopt only if it serves (1) the fixed project card / judge in under a
minute, (2) mobile-first use, or (3) the Telegram share preview.

| # | Pattern seen | Where | Verdict | Rule |
|---|---|---|---|---|
| P1 | Contact button next to the author, above the work | Dribbble "Get in touch", Behance "Message" rail | ADOPT: "Message" beside the author on every project page, first screen | 1 |
| P2 | Fixed section template for every project | Devpost (599,905 projects, same sections) | ADOPT in our shorter form (spec section 8 fields) - proves a fixed structure scales | 1 |
| P3 | Media first, chrome neutral, the work dominates | Behance, Dribbble, Instagram | ADOPT for the demo slot; but NOT image-only cards (they hide problem and tech) | 1, 2 |
| P4 | Image-grid cards with only author + counts | Behance, Dribbble | REJECT as-is: a recruiter cannot tell what the project solves or uses | - |
| P5 | Text-list rows (logo, name, tagline, votes), no image | Product Hunt, Peerlist, GitHub Trending | REJECT as-is: our value is the demo; text rows hide it | - |
| P6 | Hybrid card: 16:9 thumbnail + title + 2-line text + author + counts | Devpost, Arduino | ADOPT and extend: add one-line problem and 2-3 tech chips to the card | 1 |
| P7 | Bottom tab bar on mobile (5 items) | Peerlist | ADOPT (Instagram-like product): Feed, Search, Add, Messages, Profile | 2 |
| P8 | Large share image on every project (`summary_large_image`) | 6 of 7 readable sites; Devpost uses the small card | ADOPT | 3 |
| P9 | Auto-generated per-project share image | Hugging Face (social thumbnail per Space) | ADOPT: generate our own share image (title, one-line problem, tech, author on a branded frame) so every Telegram preview is consistent even without a good screenshot | 3 |
| P10 | "Available for work" + Message on the profile header | Behance, Dribbble | ADOPT: spec's "open to work" toggle shown as a badge next to Message | 1 |
| P11 | Category chips row above the feed | Behance, Hugging Face, Arduino | ADOPT: matches spec D7 (filter by field) | 2 |
| P12 | Rating with sub-scores (Idea / Execution / Design) | Peerlist | NOTE for Phase 2 reviews, not Phase 1 | - |
| P13 | Live interactive demo embedded | Hugging Face | NOTE for later; Phase 1 is video / images only (spec D3) | - |
| P14 | Promo banners and hiring marketing on the first screen | Arduino, Dribbble | REJECT: pushes the work below the fold | 2 |
| P15 | Engagement counts as the hero (Like 8374 on top) | Devpost, Product Hunt | REJECT for the project page header: popularity is not quality; counts go small, under the content | 1 |

## 3. Share preview facts (Telegram card, spec D5)

| Site | twitter:card | og:image |
|---|---|---|
| Devpost | summary (small) | uploaded medium thumbnail |
| Hugging Face | summary_large_image | auto-generated per Space |
| Arduino | summary_large_image | cover image |
| GitHub | summary_large_image | owner-uploaded social image |
| Peerlist | summary_large_image | project image |
| Behance | summary_large_image | cover (1400 px) |
| Product Hunt | summary_large_image | 1024x512 crop |
| Dribbble | unreadable (bot wall) | - |

Behance's og:description is cut at about 250 characters with missing spaces - a reminder to write
our description tag from the one-line problem field, not from free text.

## 4. Visual observations (inputs to directions, not decisions)

- Showcase sites keep the interface neutral (white or near-white, black text, one accent colour)
  and let the work carry the colour: Behance blue, Dribbble navy + pink, Product Hunt coral on
  CTAs only, Peerlist green.
- Rounded corners 8-16 px, thin 1 px grey borders or no borders, pill-shaped buttons are the
  current norm (Peerlist, Dribbble, Product Hunt) - safe but generic.
- Desktop content widths: single project column about 640-800 px (Peerlist, Arduino) or a wide
  media column about 1024-1135 px (Dribbble, Behance).
- Feed grids: 4 columns on desktop (Devpost, Behance, Dribbble, Hugging Face), 3 (Arduino);
  1 column on mobile everywhere except Arduino (2).

## Correction (Bek, 2026-11-17): desktop first

The first draft of this study judged patterns by the first PHONE screen. Bek corrected the
priority: Project House is mainly a website (spec D18). The gap in section 1 holds on desktop
too - no site shows demo + problem + result + tech + contact together on the first desktop
screen: Devpost (tech at the end, no contact), Product Hunt (no tech field, no contact), Behance
(Message in the side rail, but tags at the end and no problem/result), GitHub (topic chips
visible, but no demo and no contact), Hugging Face (the live app, no tech field, no contact). Pattern P7 (bottom tab bar) moves to the phone layout, designed last. The desktop
answer is a two-column first screen: demo on the left, the evaluation panel (problem, result,
tech, role, licence, author with Message) on the right.

## 5. What this means for our design

Our distinctive move is an **evaluation-first project page**: on the first phone screen, in this
order - demo (16:9), title, one-line problem, result with a number, tech chips, author row with
Message. Everything else (description, images, links, comments) follows below. The feed card is
a compressed version of the same thing. The visual direction is still open; candidates are in
the direction study.
