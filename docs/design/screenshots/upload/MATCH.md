# Upload page: mockup vs build

Compared at 1280 x 853 (the mockup's size) with the mockup's own Quloq text loaded through
`fixture-project.json` (API answers replaced in Playwright), production build (`next start`).
Positions were measured by scanning card borders in both images (`diff-1280.png`, `pair-1280.png`).

| Element | Mockup | Ours | Verdict |
|---|---|---|---|
| Header height, bottom line | 42 px | 42 px | MATCH |
| Logo and name | "Projectfolio" | "Prostagram", same logo shape | EXPECTED (decision D3) |
| Breadcrumb | centred | same | MATCH |
| Draft saved | right of the header | removed | EXPECTED: nothing is saved before Render (Bek, 2026-11-24, D24) |
| Render project button | x 1104-1250, h 29 | x 1105-1250, h 29 | MATCH |
| Title "Build your project page" | 32.7 px, x 45 | 32.7 px, x 45 | MATCH |
| Side nav | x 31-216, rows 37 px | none | EXPECTED: removed, page fills the width (Bek, 2026-11-24, D27) |
| Middle column | x 232-743 | x 232-742 | MATCH |
| Right column | x 758-1250 | x 758-1250 | MATCH |
| Project details, first rows | label/input positions | within 3 px | MATCH |
| Project details height | 357 px | smaller since D25 | EXPECTED: added Category, Post language, Mobile app; AI powered and audience removed (Bek, 2026-11-24, D25) |
| Project type chips | 5 in one row | 5 in one row, Mobile app on row 2 | MATCH + EXPECTED |
| Technology card height | 139 px | 136 px | MATCH |
| Frameworks chips | 2 rows | 2 rows | MATCH |
| pyannote.audio logo | red waveform | letter badge "P" | DIFFERENT: simple-icons has no logo for it |
| Deliverable | one dropdown "Web app + source code" | chips, several choices | EXPECTED (decision D11) |
| Getting started text | fits | cut at "Run Do..." | MINOR: the mockup uses ~11 px text in this one field only |
| How it works, Started/Finished | not in mockup | added in the same style | EXPECTED (D10, D13) |
| Demo video card | y 132-419 | y 132-420 | MATCH |
| Video preview, file row | as drawn | same | MATCH |
| GitHub card and preview | as drawn | same | MATCH |
| README lines | ~7 px mono, full lines | 7.5 px mono, last line cut | MATCH (text barely readable, as in the mockup) |
| Ready to render card | four checks | three checks, "Repository linked" removed | EXPECTED: the repository is optional (D25) |

Fonts: Figtree (closest of 8 candidates), JetBrains Mono for the README lines (closest of 9; the
mockup is blurry there), Onest for Cyrillic letters (Figtree has none).

Text sizes are measured from the mockup (word widths): labels 11 px, technology chips 10.5 px,
card subtitles 11.5 px. On phones (below 640 px) inputs are 16 px and controls 44 px tall.

Other sizes: since D27 the page fills every width (edges at the header's 38 px / 30 px); 768 and below stack the
sections in form order (details, video, repo, technology, setup, ready). No horizontal scroll at 1920, 1440, 1280,
768, 390 or 360 (scrollWidth equals clientWidth).
