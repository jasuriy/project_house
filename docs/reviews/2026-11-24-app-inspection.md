# Prostagram app inspection, 2026-11-24

Scope: home `/`, upload page `/new`, project page `/projects/test-2`, all live on
https://projecthouse-pied.vercel.app (read-only; "Render project" never pressed, no video uploaded,
nothing typed into the repository field because leaving it fires `POST /repos/preview`).
The project-page change (no "Try demo", no "View source", native video controls, no 00:59 badge)
was local when this inspection started. During the run another session committed it as `52889bd`.
Whether it is deployed is unknown [U: reload the live page and look for "Try demo"]. The live
screenshots below still show the removed elements. It is treated as done: those elements are left
out of every finding and every measurement count.
The mockups were not used as the standard.

Evidence tags: `[V]` measured on the live page or read in the source at the cited line, `[D]` derived
from `[V]` facts, `[A]` assumed, `[U]` unknown. Screenshots are in `.playwright-mcp/inspect/` (paths below are
relative to that folder). Source paths are relative to `frontend/src/`.
Guidelines are from the ui-ux-pro-max skill (`ux` domain) unless marked "own reasoning".

## Summary: the five most damaging problems

1. "Ready to render" never checks Setup & delivery (5 required fields), so it can show all green while Render still refuses (finding 1).
2. The only Render button sits in a header that scrolls away, above a form 1015 px tall (desktop) and 2620 px tall (phone). The footnote at the bottom points to that button, and a server error shows far from it (finding 2).
3. 23 different font sizes on the project page and 12 on the upload page. They are mostly 0.1 to 1 px apart, and all headings use weight 800, so the hierarchy is flat. The README text is 9.2 px, and 7.5 px in the source for the upload preview (finding 3).
4. The project page states several facts twice: type, status and deliverables. "Languages" means two different things on the same page (findings 4, 5).
5. Header items that look like controls do nothing (GitHub mark, avatar with chevron, "Explore projects"), breadcrumbs lead nowhere, and `/new` has no way back to home (finding 7).

## Findings

### 1. [BLOCKER] "Ready to render" ignores the Setup & delivery section

- Page / element: `/new`, "Ready to render" card.
- What is wrong:
  - `READY_ITEMS` has three entries: details, video, tech (`components/editor/sections.ts:14-17`) [V]. The Setup & delivery fields (deliverables, getting_started, requirements, license, status) are required (`sections.ts:11`) but appear in no checklist item [V].
  - Live: with details and tech filled and all of Setup & delivery empty, the card shows "Project details complete" and "Technology stack added" ticked, and "Demo video uploaded" is the only open item (`new-1280-ready-partial.png`) [V]. After a video upload, all three would be ticked while Render is still refused for 5 missing fields [D].
  - The card's text "Your showcase will include outcomes, video, code, and setup details." (`components/editor/ready-card.tsx:25`) promises "code" even when no repository is linked, which D25 allows [V]. So the text is false for repo-less projects [D].
- Why it matters: the one element whose job is to say "you are ready" tells the user so when they are not.
- Fix:
  - Add a fourth item, "Setup & delivery complete", with `fields: SECTIONS[3].fields`. Better: build `READY_ITEMS` from `SECTIONS` so a new section can never be left out.
  - Delete the "Your showcase will include..." line. It repeats the checklist and is sometimes untrue.

### 2. [MAJOR] Render is out of sight where the user finishes the form

- Page / element: `/new`, the header "Render project" button, the footnote "Review your details, then click Render project.", and the render error.
- What is wrong:
  - The header is `position: relative`, not sticky [V: computed style]. The page is 1015 px tall at 1280 and 2620 px tall at 390 [V]. The footnote (`ready-card.tsx:30`) is the last line of the page and points to a button that has scrolled off the top [D].
  - A server error from Render appears in the right column above the Ready card (`components/editor/project-editor.tsx:99-100`) [V]. On a phone that is about 2400 px below the button that was pressed [D].
  - A refused Render scrolls to the first section with a missing field (`project-editor.tsx:113-115`) but does not focus the field [V].
- Why it matters: the main action of the page is hidden at the moment the user wants it, and the outcome of pressing it can appear off-screen.
- Fix:
  - Make the Ready card the single place to render: put the "Render project" button inside it and make the right column sticky on desktop (`lg:sticky lg:top-4`).
  - On phone, show a sticky bottom bar with the same button and the count of missing items.
  - Remove the header button, so there is still only one Render control, and remove the footnote.
  - Show render errors inside the Ready card, and focus the first invalid field after the scroll.
- Owner decision: keep a second Render button in the header? Recommended: no. Two buttons that do the same thing is the redundancy you already rejected.

### 3. [MAJOR] Font sizes have no scale

- Pages: all.
- What is wrong:
  - **Distinct sizes.** The project page at 1280 uses 23 distinct sizes [V: computed-style census of visible text, removed items excluded]: 40.2, 19.9, 17.5, 17.4, 17.2, 16.6, 16.5, 15.1, 13.6, 13.2, 13.1, 12.9, 12.8, 12.5, 12.2, 12.1, 12, 11.9, 11.8, 11.5, 11.3, 10.9, 9.2 px. At 390 it uses 22 [V]. `/new` at 1280 uses 12: 32.7, 19, 16.5, 15.4, 13.5, 12.5, 12.3, 12.2, 12, 11.5, 11.3, 11 px [V]. The source contains 29 different fractional `text-[N.Npx]` values (grep over `components/` and `app/`) [V].
  - **One role, five sizes.** Project-page card titles are 17.5 ("At a glance"), 17.4 ("Technology stack"), 17.2 (summary cards), 16.6 ("Repository preview") and 15.1 px (bottom cards) [V], all at weight 800 [V]. The steps are below what the eye can see, so they read as mistakes rather than levels [D].
  - **Body text.** Body text is 13.2 / 13.1 / 12.9 px in three neighbouring cards [V].
  - **Inverted hierarchy.**
    - The bottom-card body text (Getting started, Requirements...) is 10.9 px (`components/project/sections.tsx:310`), smaller than the technology chip labels (12 px) and the tech group labels (11.9 px) [V].
    - The README lines are 9.2 px mono with a 20 px line height, a ratio of 2.17 (`sections.tsx:275`) [V]. In the upload-page repo preview they are 7.5 px (`components/editor/repo-card.tsx:140`) [V, source; not triggered live].
  - **Upload form.** Upload field labels are 11 px bold (`components/ui/fields.tsx:36`, `components/editor/form-sections.tsx:113`), with 12.5 px control text [V].
  - **Weights.** Every heading on both pages is weight 800, from 15.1 px to 40.2 px [V]. Weight never separates levels.
- Guideline: "Font Size Scale: use a consistent modular scale (12 14 16 18 24 32), not random sizes"; "Readable Font Size: minimum 16px body text on mobile"; "Line Height 1.5-1.75 for body".
- Why it matters: this is the "not proportional" impression. There are too many sizes, too close together, and the smallest text holds the most useful content (setup commands).
- Fix: adopt the scale in "Proposed type scale" below. Define it once as `@theme` tokens in `app/globals.css` and replace every `text-[N.Npx]`.

### 4. [MAJOR] The project page states the same facts twice

- Page / element: `/projects/test-2`, hero, summary cards, At a glance, bottom cards.
- What is wrong:
  - **Project type**: the hero badge "WEBSITE" (`sections.tsx:82`) and At a glance "Type: Website" (`sections.tsx:152`) [V]. Both are visible on the first screen at 1280 (`project-1280-full.png`) [V].
  - **Status**: the hero byline "By Jasurbek • Beta" (`sections.tsx:93`) and At a glance "Status: Beta" (`sections.tsx:154-161`) [V].
  - **Deliverables**: the "What you get" card (`sections.tsx:127-135`) lists "Hosted web app", "API". At a glance "Delivery" (`sections.tsx:163`) repeats them as "Hosted web app + API" [V].
  - **License** gets a full bottom card for one word, "MIT": 181 px wide at 1280, 285 px at 1920 [V]. It is a fact of the same kind as Type and Status, which live in At a glance [D].
- Guideline: own reasoning (no skill entry covers repeated display facts; the closest is "Redundant Entry", which is about forms).
- Why it matters: repetition wastes the most valuable space and makes the page look padded.
- Fix (recommended set):
  - At a glance becomes the one home for facts: Status, Post language, Timeline, License.
  - Remove the "Type" row and keep the hero badge.
  - Remove the "Delivery" row, because "What you get" already lists the deliverables.
  - Remove the status from the byline.
  - Remove the License card.
- Owner decision: is the type shown in the hero badge or in At a glance? Recommended: the hero badge, because it identifies the project at first sight.

### 5. [MAJOR] "Languages" means two different things on one page

- Page / element: `/projects/test-2`, At a glance and Technology stack.
- What is wrong:
  - At a glance "Languages: English" shows the post language (`sections.tsx:153`) [V].
  - The Technology stack row "Languages: Python, JavaScript, Rust..." shows programming languages (`lib/catalog.ts` `techRows`, group "Languages") [V].
  - The upload page calls the first one "Post language" and the second "Programming languages" (`form-sections.tsx`) [V].
- Why it matters: a visitor reads "Languages: English" and then "Languages: Python" a few hundred pixels apart.
- Fix: rename the At a glance row to "Written in" (or "Post language", matching the form).

### 6. [MAJOR] The upload preview keeps the player redundancy just removed from the project page

- Page / element: `/new`, Demo video card after an upload (source; not triggered live, because uploading is a POST).
- What is wrong:
  - The preview hides the native controls until a custom round play button is pressed (`components/editor/video-card.tsx:176` `controls={playing}`, `:184` "Play preview") [V].
  - It overlays a duration badge (`:195`) [V], and the meta line under it prints the same duration again (`:137`) [V].
  - "Upload complete" with a green dot (`:142`) repeats the Ready card's "Demo video uploaded" [V].
- Why it matters: it is the same "Try demo button + 00:59 badge" pattern you rejected on the project page. The two pages now behave differently for the same video [D].
- Fix:
  - Use `<video controls>` from the start, the same as `components/project/demo-player.tsx`.
  - Delete the custom play button and the duration badge.
  - Keep the duration only in the meta line ("33.4 MB · 0:58").
  - Keep "Upload complete" only while it is new information, or drop it in favour of the Ready card item.

### 7. [MAJOR] Things that look like controls but do nothing; no way out of `/new`

- Pages: project page header and breadcrumb, `/new` header, home.
- What is wrong:
  - **Project header, static items** (`sections.tsx:50-59`) [V]:
    - "Explore projects" is centred and styled like a nav link but is a `span`.
    - The GitHub mark is a `span` with `aria-hidden`. It sits next to the real "Open on GitHub" link further down.
    - The avatar has a dropdown chevron but no menu.
    - D6 made these static on purpose.
  - **Breadcrumb links lead nowhere.**
    - Project page: "Home > Projects / AI & Machine Learning" contains no links (`sections.tsx:69-73`), and there is no projects list page [V].
    - `/new`: "Home > Workspace / New project" names a "Workspace" that does not exist (`components/editor/editor-header.tsx:20`) [V].
  - **The logo links home only on the project page** (`sections.tsx:42`). On `/new` it is a plain `div` (`editor-header.tsx:9`) [V], so the only in-app way to leave `/new` is the browser back button [D].
- Guideline: own reasoning. The skill's "Input Affordance" and "Hover States" entries are about inputs and hover feedback and do not cover decoration styled as navigation, and no skill entry covers breadcrumbs.
- Why it matters: dead controls are the first thing a tester clicks, and each dead click reads as a bug.
- Fix:
  - Make the logo a `Link` to `/` on every page.
  - Remove "Explore projects", the header GitHub mark and the avatar chevron until those features exist.
  - Remove the `/new` breadcrumb. On the project page, keep only the category as a plain label above the title, or drop the breadcrumb.
- Owner decision: D6 keeps the static header items as placeholders. Remove them until login and explore exist? Recommended: yes. Show only what works.

### 8. [MAJOR] The repository preview card is mostly decoration

- Page / element: `/projects/test-2`, "Repository preview".
- What is wrong:
  - **"Public" never changes.** The badge is hard-coded (`sections.tsx:234`), and the backend refuses private repositories (`backend/app/github.py:84`) [V]. It is always "Public", so it tells the visitor nothing [D].
  - **"README.md" appears twice**: as the highlighted last file row and as the header of the right pane (`sections.tsx:252-273`) [V].
  - **The file rows look clickable but are not.** They are plain `li` elements with a "selected" highlight on README [V], so they look like a file browser but do nothing.
  - **The README is shown as raw markdown**: "### **...** Performant, customizable web apps..." with the markdown symbols and an emoji visible, at 9.2 px (`project-1280-full.png`) [V].
  - "Open on GitHub" is the only action in the card [V].
- Why it matters: about 200 px of the page shows three folder names and markdown source.
- Fix:
  - Shrink it to a compact link card: repo name, description, "Open on GitHub". Drop the badge and the file list.
  - If the README stays, strip markdown symbols and show it at body size (14 px), not as code.
- Owner decision: keep the file list and README? Recommended: no. Keep the repo name, description and link.

### 9. [MAJOR] Project page: four column grids that never line up

- Page / element: `/projects/test-2`, all rows.
- What is wrong:
  - **Column edges.** Each row has its own grid (`app/projects/[slug]/page.tsx`) [V]:
    - row 1: a fixed 415 px hero column plus 3 equal cards
    - row 2: 730fr : 430fr
    - row 3: 512fr : 643fr
    - row 4: five widths weighted 249 / 240 / 228 / 207 / 181, copied from the mockup (`sections.tsx:290`)

    At 1920 the right edges of the left blocks are at 1181, 844 and 441 px [V], so no two rows share an edge.
  - **Gaps between rows and cards** are 17, 25, 30 and 20 px [V].
  - **Ragged bottoms.** Technology stack is 233 px tall and Repository preview 206 px at 1280; at 1024 they are 338 vs 206 px [V].
  - **At 1024** the three summary cards are squeezed to 154 px each next to the fixed 412 px hero, and "Getting started" wraps onto two lines (`project-1024-full.png`) [V].
  - **At 1920** each summary card is 453 px wide holding one line of text [V].
  - **At a glance** has `lg:min-h-[281px]` (`sections.tsx:167`), which adds 50 px of empty space under its last row at 1280 [V]. At 1920 there are 357 px of empty page under it, next to the video [V]. D27 accepted this growth.
- Guideline: own reasoning (no skill entry on grid alignment).
- Why it matters: edges that almost line up look like mistakes. Proportions copied from a mockup do not survive real content.
- Fix:
  - Use one 12-column grid with one gap (24 px) for every row: hero 12, video 8 / At a glance 4, tech 7 / repo 5 (or tech 12 when there is no repo), bottom cards in equal columns.
  - Drop `DETAIL_WEIGHTS` and `min-h-[281px]`.
  - Stretch paired cards to equal height (`items-stretch`).
- Owner decision: D27 says "fill the width". Cap the content at about 1440 px and centre it? Recommended: yes. At 1920 every card stretches while its text stays the same size.

### 10. [MAJOR] Desktop form controls are tiny; several targets are below 24 px

- Page / element: `/new`.
- What is wrong:
  - Text inputs and selects are 25 px tall with 12.5 px text (`fields.tsx:74`, `:121`) [V]. Project-type chips are 30 px and the Render button 29 px [V].
  - At 1920 the name input measures 905 x 25 px [V], a sliver.
  - Measured at 1280 [V]:
    - chip remove "x": 14 x 14 px
    - picker chevron: 18 x 16 px
    - "Still ongoing" checkbox: 15 x 15 px
  - On phone the checkbox is 15 x 15 px and its label 85 x 17 px [V].
- Guideline: "Target Size (Minimum): WCAG 2.2 AA requires 24 CSS px pointer targets" (web); "Touch Target Size" (mobile 44).
- Why it matters: small controls look cramped and are hard to hit, especially the remove "x".
- Fix:
  - Controls 36 px tall on desktop with 14 px text; keep 44 px and 16 px on phone (the iOS no-zoom rule).
  - Chip remove button at least 24 x 24 px.
  - Make the whole "Still ongoing" row a 44 px label on phone.

### 11. [MAJOR] Status and error colours fail contrast

- Pages: `/new` (all items); project page (input borders do not apply there).
- What is wrong (WCAG ratios computed from the token hex values) [V]:
  - **Success text** `#2eb158` on card `#fdf9f8`: 2.66:1. Used for "Upload complete" and "Repository connected" (12 px).
  - **Danger text** `#e5484d` on card: 3.74:1. Used for "Required" (11 px) and the date error (12 px).
  - **Placeholder** `#8b8a99` on field `#fefbfa`: 3.29:1. Used for "e.g. npm install, npm run dev".
  - **Input border** `#dcd5d4` on field: 1.41:1. WCAG 1.4.11 asks 3:1 for the outline of a control (own reasoning; the skill search returned no non-text-contrast entry).
- Guideline: "Color Contrast: minimum 4.5:1 for normal text".
- Why it matters: the error and success messages, the ones that must be read, are the faintest text on the page.
- Fix (ratios computed) [V]:
  - `--color-success-ink: #1a7f3c` (4.85:1) for text, keeping `#2eb158` for fills
  - `--color-danger: #c4282e` (5.44:1)
  - placeholder `#706f80` (4.77:1)
  - `--color-field-line: #8c8697` (3.41:1)

### 12. [MAJOR] Unknown project address shows the unstyled Next.js 404

- Page / element: `/projects/<unknown>`.
- What is wrong: `notFound()` (`app/projects/[slug]/page.tsx:34`) renders the framework default: a white page saying "404 | This page could not be found." with no header, logo or link home (`project-404-1280.png`) [V]. `app/` contains no `not-found.tsx` [V].
- Why it matters: a mistyped or deleted link is a dead end that does not look like the product.
- Fix: add `app/not-found.tsx` with the site header, one sentence ("This project does not exist.") and a link to `/`.

### 13. [MAJOR] The home page does not say what the site is

- Page / element: `/`.
- What is wrong:
  - The whole page is the logo, the avatar and one "Add project" button in an empty screen [V: `document.body.innerText` = "Prostagram / Add project"; `home-1280.png`, `home-390.png`].
  - The avatar does nothing [V], and the header differs from the project page's header (finding 15).
- Guideline: "Empty States: show a helpful message and action; don't leave blank empty screens".
- Why it matters: friends get this link (D22). The first page they see neither explains the product nor shows an example.
- Fix: one headline and one sentence explaining Prostagram, the "Add project" button, and a link to one example project page.
- Owner decision: show an example project link on the home page? Recommended: yes, until an explore page exists.

### 14. [MAJOR] Tag picker: four fields all named "Add"; the search box duplicates the field

- Page / element: `/new`, Post language, Programming languages, Frameworks & tools, Deliverable.
- What is wrong:
  - **All four triggers are named "Add".** The visible label points (`htmlFor`) at the chevron button, which has `aria-label="Add"` (`components/ui/tag-picker.tsx:101`). The aria-label overrides the label: the accessibility tree has four buttons named "Add" and zero named "Post language" [V: Playwright `getByRole('button', {name: 'Add'})` count 4].
  - **A second, separate search input appears below the field** when it opens (`tag-picker.tsx:114-131`). The user sees two stacked boxes, one saying "Choose..." and one taking the typing (`new-1280-tech-picker.png`) [V].
  - **No arrow-key navigation.** ArrowDown in the search box does nothing; Enter adds the first match only (`tag-picker.tsx:119`) [V: live, focus stayed in the input].
- Guideline: "Keyboard Navigation: complete keyboard navigation"; "Form Labels: inputs must have associated labels".
- Why it matters: screen-reader users cannot tell the four fields apart, and the double box looks unfinished.
- Fix:
  - Type straight into the field (an input inside the chip row, ARIA combobox pattern), with ArrowUp/ArrowDown and `aria-activedescendant`.
  - Name the chevron `Add ${label}`, or drop its aria-label and use `aria-labelledby`.

### 15. [MINOR] The header changes size between pages

- Pages: `/` and `/new` vs project page.
- What is wrong [V]:

  | | `/` and `/new` | project page |
  |---|---|---|
  | Logo mark | 23 px | 25 px |
  | Wordmark | 19 px | 19.9 px |
  | Side padding | 38 / 30 px | 52 / 50 px |
  | Gap | 7 px | 8 px |

  Sources: `app/page.tsx:12`, `editor-header.tsx:8-9`, `sections.tsx:41-47`. The header is written three times [V].
- Why it matters: the logo jumps when moving from `/new` to the published page.
- Fix: one `SiteHeader` component with a slot for the right-hand action (Render or nothing), used by all three pages.

### 16. [MINOR] Two "Choose..." placeholders that look different

- Page / element: `/new`, native selects vs tag pickers.
- What is wrong:
  - **Colour.** Native select placeholders render dark `rgb(31,30,51)` [V: computed]. The `text-faint` class (`fields.tsx:122`) loses to `text-ink-2` in the base class string (`fields.tsx:7`). Tag-picker placeholders are faint `rgb(139,138,153)` [V]. Side by side, "Choose..." under License looks like a chosen value, while under Deliverable it looks empty (`new-1280-date-error.png`) [V].
  - **Size on phone.** The tag-picker placeholder stays 12.5 px (`tag-picker.tsx:72`); the selects are 16 px [V].
- Fix: remove `text-ink-2` from the unfilled select state. Give the tag-picker placeholder the same phone size.

### 17. [MINOR] Date fields: the error is shown twice; the day is asked for but never shown

- Page / element: `/new`, Started / Finished.
- What is wrong:
  - With the finish date before the start date, "The finish date is before the start date" appears under both fields (`project-editor.tsx:56`; `new-1280-date-error.png`) [V].
  - The form asks for a full date (`type="date"`, `form-sections.tsx:257`) [V], but the project page shows only month and year ("Aug 2026 - Nov 2026", `lib/catalog.ts` `timeline`) [V].
- Fix:
  - Show the error once, under Finished.
  - Ask for month and year only. `type="month"` is not supported by every desktop browser [A: Safari and Firefox desktop fall back to a text box], so use two small selects (month, year).

### 18. [MINOR] Repository field: no visible label, optional status not shown, hidden "connect" step

- Page / element: `/new`, GitHub repository card.
- What is wrong:
  - The input's label is screen-reader-only [V: 1 x 1 px].
  - Nothing says the field is optional (D25).
  - The link connects only on blur or Enter (`repo-card.tsx:74`). There is no button, which is why the error text has to say "press Enter" (`project-editor.tsx:52-53`) [V].
- Fix: title "GitHub repository (optional)", plus a visible "Connect" button next to the input. The error text then becomes "Connect the repository or clear the link".

### 19. [MINOR] The selected project-type chip pushes its neighbours sideways

- Page / element: `/new`, Project type.
- What is wrong: the selected chip gains a check icon (`components/ui/chip-choice.tsx:36`) and grows. "Website" moves from x = 163 to x = 186 when "Web app" is selected (`new-1280-full.png` vs `new-1280-ready-partial.png`) [V]. The chip is also tinted, so the check is a second signal for the same state [D].
- Fix: drop the check (the tint and border already mark the selection), or reserve its width in every chip.

### 20. [MINOR] Phone: the video comes after three text cards

- Page / element: `/projects/test-2` at 390.
- What is wrong: the video starts at y = 734 on an 844 px screen with the live buttons [V]. Without the removed buttons that is about 680 px [D, minus the 54 px button row]. In both cases Problem, Outcome and What you get come first (`project-390-full.png`) [V].
- Fix: on phone, place the video directly after the hero (`order-*`, as `/new` already does).

### 21. [MINOR] Spacing, radius and colour values are not a system

- Pages: all.
- What is wrong [V: computed paddings and gaps; grep of the source]:
  - **Card paddings.** Five variants on the project page: 12/13/21/17, 7/20/12/20, 6/20/14/20, 6/17/15/17 and 11/20/13/20 px. Upload cards use 5/15/14/15 px (`components/ui/card.tsx:18`). The 5-7 px top padding with 12-21 px bottom pushes the titles against the top border.
  - **Gaps.** 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 20, 25 and 30 px are all in use.
  - **Radii.** 6, 7, 8, 10 and 12 px, plus pills. Chips alone use 6 (tag), 7 (type choice) and 8 px (tech).
  - **Raw hex.** 30 raw hex classes with 23 distinct values sit beside the tokens. Among them are about 10 lavender tints that differ only slightly (`#dcd9ff`, `#e4e1fb`, `#e8e4f8`, `#ebe9fb`, `#e6dffb`, `#e2daf6`, `#d9d5f5`, `#d3cffd`, plus the `#dedcff` and `#efe9fd` tokens) and 8 near-whites (`#fffefd`, `#fffdfc`, `#fdfaf9`, `#fbf8f7`, `#fdf9fb`, plus page, card and field).
- Guideline: "Raw hex in components" is listed under Typography & Color anti-patterns (skill priority table).
- Fix: use the sets in "Proposed spacing / radius / colour set" below.

### 22. [MINOR] Four different icon treatments

- Page / element: project page and `/new`.
- What is wrong [V]:
  - summary cards: an 18 px icon in a 34 px tinted box (`sections.tsx:101`)
  - At a glance: bare 18 px icons
  - bottom cards: bare 23 px icons
  - upload cards: bare 19-20 px icons

  None of them carries information [D].
- Fix: one treatment, a bare 20 px icon beside the card title. Or drop the icons from the At a glance rows and bottom cards.

### 23. [MINOR] Card subtitles repeat their titles

- Page / element: `/new`.
- What is wrong [V] (`video-card.tsx:84`, `:121`; `repo-card.tsx:59`):
  - "Demo video" / "Upload a demo video that shows your project in action." / "Drop a video here or choose a file".
  - "GitHub repository" / "Link your project repository with source code, setup, and docs."
  - "Build your project page" / "Everything someone needs to understand your project."
- Fix: delete the card subtitles. The title and the control already say it.

## Proposed type scale

Six steps, exactly the skill's guidance: 12 / 14 / 16 / 18 / 24 / 32 px.
- **Ratios.** Consecutive steps are 1.17 (14/12), 1.14 (16/14), 1.13 (18/16), 1.33 (24/18) and 1.33 (32/24): small steps for running text, bigger jumps for titles.
- **Weight.** Weight separates roles that share a size: titles 700-800, labels 600, body 400. Labels sit on the body size (14) and differ by weight only, so there is no 13 px step.
- **Phone.** The only phone-specific sizes are body and inputs at 16 (readability, and the iOS no-zoom rule), and the project name at 28 so long names fit.
- **Wordmark.** It is a logo size outside the text scale.

| Token | Role | Desktop size / line height | Phone | Weight | Replaces (measured) |
|---|---|---|---|---|---|
| `text-display` | project name (h1) | 32 / 40 | 28 / 36 | 800 | 40.2, 34 |
| `text-title` | `/new` page title | 24 / 32 | 24 / 32 | 800 | 32.7, 26 |
| `text-heading` | every card / section title | 18 / 26 | 18 / 26 | 700 | 17.5, 17.4, 17.2, 16.6, 16.5, 15.1 |
| `text-lead` | short description, page subtitle | 16 / 24 | 16 / 24 | 400 | 16.5, 15.4, 15 |
| `text-body` | card text, At a glance values, inputs, Getting started / Requirements text | 14 / 22 | 16 / 24 | 400 | 13.2, 13.1, 12.9, 12.5, 10.9 |
| `text-label` | field labels, At a glance terms, tech group names, chips, buttons | 14 / 20 | 14 / 20 | 600 | 13.6, 13, 12.8, 12, 11.9, 11.5, 11 |
| `text-caption` | breadcrumb, byline, file names, helper and error text, badges | 12 / 16 | 12 / 18 | 400-500 | 12.3, 12.2, 12.1, 11.8, 11.5, 11.3 |
| `text-mono` | README excerpt if kept (code font on the caption step) | 12 / 20 | 12 / 20 | 400 | 9.2, 7.5 |
| wordmark (logo, outside the scale) | "Prostagram" | 20 / 28 | 20 / 28 | 800 | 19.9, 19 |

Inputs keep 16 px on phone only (the iOS Safari no-zoom rule, `fields.tsx:9`).
Result: 6 text sizes instead of the measured 23 (project page) and 12 (upload page).

## Proposed spacing / radius / colour set

| Kind | Set | Use |
|---|---|---|
| Spacing | 4, 8, 12, 16, 24, 32, 48 | 8 label-to-control; 16 between fields; 24 between cards and rows; 48 page bottom |
| Card padding | 20 all sides (16 on phone) | replaces the six measured variants |
| Control height | 36 desktop, 44 phone | inputs, selects, pickers, buttons |
| Radius | 6 controls and chips; 8 inner panes and video; 12 cards; full for pills and avatars | replaces 6 / 7 / 8 / 10 / 12 mix |
| Surface colours | `page #fbf7f6`, `card #fdf9f8`, `field #fefbfa` | drop the 5 near-white raw hex values |
| Lines | `line #ebe4e3` (card borders), `field-line #8c8697` (3.41:1) | drop `#f0ebea`, `#efe9e8`, `#ede7e6`, `#e2dcdb` |
| Accent tints | `primary-soft #dedcff` (selected), `primary-tint #efe9fd` (panels) | drop the 8 raw lavender values |
| Text | `ink`, `ink-2`, `muted #5a596c` (6.4-6.5:1), `placeholder #706f80` (4.77:1) | `faint #8b8a99` only for decorative marks |
| Status | `success-ink #1a7f3c` (4.85:1) for text, `#2eb158` fills only; `danger #c4282e` (5.44:1) | |

## Checked and fine

- No horizontal scroll at 390 on `/`, `/new` or the project page: `scrollWidth` 390 = viewport [V].
- These contrasts pass [V: computed]:
  - white on primary: 7.88:1
  - primary on card: 7.54:1
  - muted text on card and page: 6.52 and 6.41:1
  - type badge: 5.33:1
  - status pill: 6.18:1
  - tinted status select: 8.36:1
- Phone touch sizes on `/new` [V]: inputs, selects, chips and project-page links are 44 px tall. Chip remove buttons are 26 px, which passes WCAG 2.5.8 (24 px) though not 44.
- The project data is fetched with `cache: "no-store"` (`lib/server-api.ts:8`) [V], as section 7.3 requires.
- Tag picker [V, live]:
  - Enter adds the first match.
  - Escape closes.
  - Tab reaches the options, with the browser's default focus ring.
  - Typing an unknown name offers "Add ...".
- The date-order check works live and blocks the wrong order [V].
- Native video controls on the project page (local change, `demo-player.tsx:43-53`) [V source]: `preload="metadata"`, no autoplay, `playsInline`, and the video returns to its first frame at the end. This matches the skill's "prefer click-to-play" guidance.
- Required fields carry a red asterisk and an inline error tied to the field with `aria-describedby` (`fields.tsx:36-45`, `:72-73`) [V].
- Project-type chips are a proper `radiogroup` with `aria-checked` (accessibility tree) [V].

## Screenshots

`home-1280.png`, `home-390.png`, `new-1280-full.png`, `new-1280-ready-partial.png`,
`new-1280-tech-picker.png`, `new-1280-date-error.png`, `new-1440-full.png`, `new-1920-full.png`,
`new-390-full.png`, `project-1024-full.png`, `project-1280-full.png`, `project-1440-full.png`,
`project-1920-full.png`, `project-390-full.png`, `project-404-1280.png`
(all in `.playwright-mcp/inspect/`). The project-page screenshots are of the live deploy, so they
still show "Try demo", "View source" and the 00:59 badge, which this report ignores.

## Counts

BLOCKER 1, MAJOR 13, MINOR 9 (23 findings).
