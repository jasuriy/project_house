# Profile page: ours vs mockup screens 3 and 3b

Design: `docs/design/2026-11-17-screens-mockup.html` (#s-profile, #s-profile-company), captured as
`mockup-profile-*.png` and `mockup-profile-company-*.png` (desktop, tablet, phone).
Ours: `ours-<user>-<width>.png` at 1440, 768, 390 for a developer with 29 projects
(`aziz-rahimov`), a verified company (`dilnoza-karimova`) and a developer with nothing filled in
(`empty-dev`); also 1024 and 1920 for the developer, `ours-aziz-rahimov-1440-about.png` (About tab)
and `ours-aziz-rahimov-1440-owner-uz.png` / `-owner-ru.png` (logged in as the owner).

Matches: 320 px side card + projects grid (2 columns at 1024, 3 from 1280, 4 from 1536; cards 279 / 296 / 297 px), avatar 96 px with initials and the
mockup gradient (now tokens `--color-avatar-from/to`), name 24 px, headline 15 px, open-to-work /
verified badges, facts in muted 14 px, stat tile, privacy line, tabs 15 px with the 2 px primary
underline, tablet header card (photo left, facts inline), phone stacked layout.

Known differences (intended):

| Where | Mockup | Ours | Why |
|---|---|---|---|
| Header | search, Xabarlar, Loyiha qo'shish, avatar | current header | header items come with their features (Bek, 2026-11-18) |
| Actions | Xabar yozish + Ulashish, two equal halves | owner: Profilni tahrirlash + Ulashish sharing the row (wrap to two rows when a translation is long, e.g. ru); visitor: Share across the row | DMs are step 5 |
| Stats | projects + likes tiles | projects tile only | likes are step 4 |
| Company stats | none | none | as mockup |
| Links | "LinkedIn, shaxsiy sayt" on one line | one line per link (GitHub, LinkedIn, site host) | each link is its own 44 px tap target |
| Company facts | location, site | company name, location, site | company name is its own field; the headline may hold only the role |
| Company avatar | lighter gradient | same gradient as developers | one avatar style; not worth two more tokens |
| Company About title | 18 px | 20 px (`text-h3` token) | no 18 px token |
| Company panel note "Phase 1..." | shown | not shown | mockup annotation, not product copy |
| Card author | username + like count | display name | the feed card design (likes later) |
| Tab line | faint vertical line left of the active tab | same | Chrome inset-shadow rendering, present in the mockup too |

Checks: no horizontal scroll at 1440/768/390; owner view shows Edit profile and the header name links to `/aziz-rahimov`; projects loaded with load more (24 -> 29) survive About -> Projects; `/aziz-rahimov` 200, `/nobody-here` 404,
`/robots.txt` 404 (no API call); owned sample `/aziz-rahimov/apache-superset` 200 with the author
linking to the profile, `/demo/apache-superset` 404; feed shows no "Sample" badge for owned samples.
Long data (`ours-long-links-390.png` / `-768.png` / `-1440.png`): a 39-character GitHub name, a long website host and a
long location wrap inside the card; page width stays 390 at 390 px, links and facts end inside the card at 390, 768 and 1440.
