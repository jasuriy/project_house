# Project House design guide (Phase 1)

Status: approved direction, 2026-11-17. Bek chose the layout and palette 2 (professional blue + green).
Tokens: `docs/design/tokens.css` (Tailwind v4 `@theme`). Mockups: `docs/design/2026-11-17-screens-mockup.html`
(published as https://claude.ai/artifact/WSWXZAnXvRY3u9Mnx1ZrqC, private).
How we got here: `docs/research/2026-11-17-ui-research-findings.md`.

Evidence tags: [V] measured or read from source, [D] derived, [A] assumption.

---

## 1. Principles

1. **Evaluation first.** A project page answers "is this person good?" on the first screen: demo,
   title, one-line problem, result, tech, author with Message. Nothing else competes with that.
2. **The work brings the colour.** The interface stays neutral (white cards on a pale blue page);
   colour comes from project media. One action colour (primary blue), green only for positive states.
3. **Same thing, same place.** Every project uses the same fields in the same positions on every
   screen size (spec D1). Recruiters compare by position.
4. **Desktop first** (spec D18), then tablet, phone last. Every screen must still work on a phone,
   because shared links open there.
5. **Outcome, not popularity.** The Result slot shows what the project achieved (accuracy, speed,
   users). Likes and views are small meta, never the headline.
6. **No decoration.** No gradients on interface elements, no shadows except the focus halo, no
   motifs, no emoji anywhere (also not as icons).

## 2. Colour

Values in `tokens.css`. Light theme only in Phase 1 [my call; dark theme later if users ask].

| Token | Hex | Use | Never |
|---|---|---|---|
| `bg` | #f0f9ff | page background | text |
| `card` | #ffffff | cards, panels, nav bar, inputs, chat | |
| `fg` | #0c4a6e | main text, headings | |
| `mute` | #475569 | secondary text, labels, meta, inactive tabs | |
| `border` | #d6ebf8 | every 1 px border and divider | text |
| `muted` | #e7eff5 | chip fill, search field, message bubble, stat tiles | |
| `primary` | #0369a1 | buttons, links, active tab underline, active filter, focus border | large fills behind long text |
| `accent-soft` | #e0f0fa | result block, focus halo, selected list row, info badges | |
| `ok` / `ok-soft` | #166534 / #dcfce7 | "Ishga ochiq" badge, success banners | buttons |
| `deco` | #0ea5e9 | logo mark only | **any text** |
| `warn-fg` / `warn-soft` | #3b2a00 / #fff7e6 | message-request banner | |
| `danger` | #b91c1c | "Shikoyat qilish" (Report), required star, destructive text | filled buttons |

**Measured contrast [V]** (WCAG 2.x ratio, script in session; requirement 4.5:1 for text):

| Pair | Ratio |
|---|---|
| fg on bg | 8.87 |
| mute on bg / on card | 7.11 / 7.58 |
| white on primary (buttons) | 5.93 |
| primary on card (links) | 5.93 |
| fg on muted (chips) | 8.14 |
| mute on muted (bubble meta) | 6.52 |
| primary on accent-soft (info badge) | 5.09 |
| mute on accent-soft (result caption) | 6.50 |
| ok on ok-soft (badge) | 6.49 |
| warn-fg on warn-soft (request banner) | 12.98 |
| danger on card | 6.47 |
| **deco on white** | **2.77 - fails, decoration only** |
| **white on #16a34a (bright green)** | **3.30 - fails, so green is never a button** |

Rule: any new text/background pair is measured before it ships.

## 3. Typography

- **One family: Inter**, weights 400, 500, 600, 700. Load with `next/font/google`, subsets
  `latin`, `latin-ext`, `cyrillic`.
- Why Inter: the font file contains Latin, Cyrillic and the Uzbek letters U+02BB (oʻ, gʻ) and
  U+02BC (ʼ) [V, checked with fontTools]. Rejected because they lack Cyrillic: Poppins, Outfit,
  Plus Jakarta Sans, Archivo, Space Grotesk; lack U+02BB: Open Sans, Geist, Manrope, Rubik,
  Golos Text, Geologica [V]. Any future font must pass the same check.
- Uzbek text uses the real characters: `oʻ gʻ` with U+02BB and `ʼ` with U+02BC, never the ASCII
  apostrophe.

| Token | Size | Weight | Use |
|---|---|---|---|
| `h1` | 30px (phone 22) | 700, tracking -0.02em | project title |
| `h2` | 24px (phone 21) | 700, tracking -0.015em | page headings ("Yangi loyihalar"), result figure |
| `h3` | 20px | 600-700 | section titles, phone top-bar titles (17) |
| `lead` | 17px (phone 16) | 400 | one-line problem on the project page |
| `body` | 16px | 400, line-height 1.5 | descriptions, message text, any running text |
| `ui` | 15px | 500-600 | nav links, buttons, inputs; card titles 16/600 |
| `small` | 14px | 400 | key-value lists, filters, link rows, list previews |
| `meta` | 13px | 400 | card meta, help text, chips inside cards |
| `caption` | 12px | 500 | badges, timestamps, tab-bar labels (phone 11) |

Numbers that are compared (results, counts) use `font-variant-numeric: tabular-nums`.
Running text stays under about 75 characters per line.

## 4. Layout and spacing

- Spacing uses the 4 px step (Tailwind default). The mockups used some in-between values
  (6, 10, 14, 18, 22 px); implementation rounds to the nearest 4 px multiple.
- Page side padding: desktop 40, tablet 24, phone 16. Content max width 1280; on screens from
  1536 px the content may grow to 1600 (Bek, 2026-11-18: wide monitors were leaving ~310 px empty
  on each side).
- Breakpoints: phone < 768, tablet 768-1023, desktop >= 1024 (`md` = 48rem, `lg` = 64rem).
  A tablet held sideways uses the desktop layout.

| Screen | Desktop (>= 1024) | Tablet (768) | Phone (< 768) |
|---|---|---|---|
| Top navigation | logo, Lenta, Kashf etish, search, Xabarlar (count), "Loyiha qoʻshish", avatar | logo, search, Xabarlar, "+ Qoʻshish", avatar; Lenta / Kashf etish become tabs on the feed | logo, search icon, messages icon; bottom tab bar (5 items) |
| Feed | 4 columns, gap 20; from 1536 px 5 columns, gap 24 (cards keep their ~300 px width) | 2 columns | 1 column |
| Project page | demo column 768 + evaluation panel | demo full width, panel below; author + Message on one row | demo edge to edge; fixed bottom bar with Message + Save |
| Profile | side column 320 + projects (3 columns) | header card + projects (2 columns) | stacked header, projects 1 column |
| Add project | form + sticky preview column 380 | form, preview below (2 columns) | one field per row; fixed bottom bar |
| Messages | list 340 + conversation | list 280 + conversation | two screens: list, conversation |

Phone bottom tab bar: Lenta, Kashf etish, **+** (add, primary filled square), Xabarlar, Profil.
Max 5 items. On a project page the tab bar is replaced by the Message + Save action bar.

## 5. Shape and elevation

| Radius | Value | Use |
|---|---|---|
| `chip` | 6px | tech chips, small thumbnails |
| `control` | 8px | buttons, inputs, search field |
| `media` | 10px | demo player, result block, banners |
| `card` | 12px | cards, panels, chat window |
| full | 999px | filter pills, badges, counters |

No drop shadows. Separation comes from `border` lines and the `card` vs `bg` contrast.
The only halo is the focus ring.

## 6. Components

**Button**
- Primary: `primary` fill, white text, 600 weight. Heights: 40 desktop / 44 phone (small 34 / 40).
- Secondary: `card` fill, `fg` text, `border` line.
- Danger: `card` fill, `danger` text, `border` line (Report). Never a red fill.
- One primary button per area. Labels say what happens: "Xabar yozish", "Eʼlon qilish", "Qabul qilish".

**Chip** - `muted` fill, `fg` text, `border` line, radius `chip`. Filter chips are pills; the active
filter is `primary` fill with white text.

**Badge** - pill, `caption` size. Green (`ok` on `ok-soft`): "Ishga ochiq". Blue (`primary` on
`accent-soft`): "Tasdiqlangan kompaniya", "Kompaniya", "AI toʻldirdi".

**Project card (feed, profile, previews)** - top to bottom: 16:9 media (play button if video),
title (16/600), one-line problem (14, `mute`, clamped to 2 lines), up to 3 tech chips, divider,
author avatar + name, like count on the right (`meta`, tabular).

**Evaluation panel (project page)** - title, one-line problem (`lead`), Result block (`accent-soft`,
caption "Natija", figure in `h2`, context line), tech chips, key-value list (Yoʻnalish, Roli,
Litsenziya, Joylandi), divider, author row with badge, actions (Xabar yozish primary + Saqlash
secondary), links row (GitHub, Demo video, Ulashish, Shikoyat qilish in `mute`).

**Form field** - label (14/600) with red `*` when required; input (`card`, `border`, radius
`control`, min height 42); help text (13, `mute`) under the input; focus = `primary` border +
3 px `accent-soft` halo. Fields filled by AI carry the "AI toʻldirdi" badge in the label until the
user edits them. Errors appear next to the field, not only at the top.

**Steps (add project)** - numbered circles with labels (a real sequence of 3): done = `ok` fill,
current = `primary` fill, upcoming = `muted`. Phone: one line "2-qadam (3 tadan)" + progress bar.

**Message request banner** - `warn-soft` fill, `warn-fg` text, radius `media`; actions: Qabul
qilish (primary), Eʼtiborsiz qoldirish (secondary), Shikoyat qilish (danger). The composer is
disabled with the text "Javob yozish uchun soʻrovni qabul qiling" until accepted (spec D9).

**Message bubble** - `muted` fill, radius 14/14/14/4, body text, timestamp in `caption`.
A shared project shows as a compact card (thumbnail + title + result).

**Share image (Open Graph, Telegram preview)** - 1200 x 630, `primary` background, white text:
project title (bold), one line with tech and the result, author avatar + name at the bottom.
`og:description` = the one-line problem. `twitter:card` = `summary_large_image`.

## 7. Icons

Lucide (SVG, 2 px stroke, 22-24 px in bars). Icon-only buttons need an accessible label.
No emoji as icons (ui-ux-pro-max rule; also the project's no-emoji rule).

## 8. Accessibility (must pass before a screen ships)

- Text contrast >= 4.5:1, measured (section 2).
- Touch targets >= 44 x 44 px on phone (buttons, tab bar, icon buttons).
- Visible keyboard focus on every interactive element (focus ring above).
- Images and demo thumbnails have alt text from the project title.
- Form inputs have visible labels, not placeholder-only.
- `prefers-reduced-motion` respected.

## 9. Motion

Only feedback motion: hover and press 150-200 ms, panel open/close 200 ms. No scroll-triggered
reveals, no parallax, no page-load animation. (ui-ux-pro-max suggested a scroll reveal; rejected
because a feed people scan quickly should not move.)

## 10. Copy

- Interface language default Uzbek (Latin), plus Russian and English (spec D10). Project content
  stays in the author's language.
- Sentence case everywhere, no ALL CAPS labels.
- Buttons are verbs; the same action keeps the same word through a flow.
- Empty states tell the user what to do next, e.g. an empty feed filter: "Bu yoʻnalishda hali
  loyiha yoʻq. Birinchisini siz qoʻshing." with an "Loyiha qoʻshish" button.
- The Uzbek copy in the mockups is a first draft and needs a native review.

## 11. Open items (not decided yet)

- Dark theme (not in Phase 1).
- Empty, loading and error states for each screen are not drawn yet; they follow sections 6 and 10.
- Explore page ("Kashf etish") content is not designed; Phase 1 can link it to the feed with
  filters until it is.
- Admin screens (spec section 9 item 9) are internal and use the same components without a mockup.
