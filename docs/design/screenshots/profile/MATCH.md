# Profile page: ours vs mockup screens 3 and 3b

Design: `docs/design/2026-11-17-screens-mockup.html` (#s-profile, #s-profile-company), captured as
`mockup-profile-*.png` and `mockup-profile-company-*.png` (desktop, tablet, phone).
Ours: `ours-<user>-<width>.png` at 1440, 768, 390 for a developer with 29 projects
(`aziz-rahimov`), a verified company (`dilnoza-karimova`) and a developer with nothing filled in
(`empty-dev`); `ours-aziz-rahimov-1440-about.png` shows the About tab.

Matches: 320 px side card + projects grid (3 columns at 1440), avatar 96 px with initials and the
mockup gradient (now tokens `--color-avatar-from/to`), name 24 px, headline 15 px, open-to-work /
verified badges, facts in muted 14 px, stat tile, privacy line, tabs 15 px with the 2 px primary
underline, tablet header card (photo left, facts inline), phone stacked layout.

Known differences (intended):

| Where | Mockup | Ours | Why |
|---|---|---|---|
| Header | search, Xabarlar, Loyiha qo'shish, avatar | current header | header items come with their features (Bek, 2026-11-18) |
| Actions | Xabar yozish + Ulashish | Share only; Edit profile + Share on your own page | DMs are step 5 |
| Stats | projects + likes tiles | projects tile only | likes are step 4 |
| Company stats | none | none | as mockup |
| Links | "LinkedIn, shaxsiy sayt" on one line | one line per link (GitHub, LinkedIn, site host) | each link is its own 44 px tap target |
| Company facts | location, site | company name, location, site | company name is its own field; the headline may hold only the role |
| Company avatar | lighter gradient | same gradient as developers | one avatar style; not worth two more tokens |
| Company About title | 18 px | 20 px (`text-h3` token) | no 18 px token |
| Company panel note "Phase 1..." | shown | not shown | mockup annotation, not product copy |
| Card author | username + like count | display name | the feed card design (likes later) |
| Tab line | faint vertical line left of the active tab | same | Chrome inset-shadow rendering, present in the mockup too |

Checks: no horizontal scroll at 1440/768/390; `/aziz-rahimov` 200, `/nobody-here` 404,
`/robots.txt` 404 (no API call); owned sample `/aziz-rahimov/apache-superset` 200 with the author
linking to the profile, `/demo/apache-superset` 404; feed shows no "Sample" badge for owned samples.
