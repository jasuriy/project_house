# Project page: mockup vs build

Compared at 1280 x 853 with the mockup's Quloq data (`fixture-project.json`, served by a test-only
API stand-in, because this page reads its data on the server), production build. Positions measured
by scanning card borders in both images (`diff-1280.png`, `pair-1280.png`). Font sizes were computed
from the mockup's word widths with the real Figtree font.

| Element | Mockup | Ours | Verdict |
|---|---|---|---|
| Header: logo, "Explore projects", GitHub, avatar | as drawn | same, "Prostagram", static (D6) | MATCH |
| Breadcrumb Projects / category | y 58 | y 58 | MATCH |
| Badge, title, description, author, buttons | x 51, y 87-257 | x 51, y 87-257 | MATCH |
| Author | "By Saloxiddin", photo | "By Jasurbek", his photo | EXPECTED (D6) |
| Three top cards | x 480 / 740 / 995, y 96-250 | x 480 / 736 / 993, y 95-247 | MATCH |
| "The outcome" text | 3 lines | 2 lines | MINOR: the mockup wraps that card's text narrower than the others |
| Video card | wide box, y 278-572 | 16:9 box, y 279-696 | EXPECTED (D23) |
| Caption under the video, play icon | shown | removed | EXPECTED (decision on display page video) |
| At a glance | x 803-1232, y 284-565 | x 803-1232, y 285-566 | MATCH |
| Badge "AI POWERED", At a glance "For" row | drawn | removed | EXPECTED: fields removed (Bek, 2026-11-24, D25); the card keeps its mockup height |
| At a glance "Type" value | "Web application" | "Web app" | MINOR: one label list (catalog) for both pages |
| Timeline row | not in mockup | shown when a start date exists | EXPECTED (D13) |
| Technology stack | x 48-560, h 201 | x 48-560, h 197 | MATCH (shifted down by the taller video) |
| pyannote.audio logo | waveform | letter badge | DIFFERENT: no logo in simple-icons |
| Repository preview | x 590-1233, h 201 | x 590-1233, h 206 | MATCH |
| Bottom cards | 5 cards, widths 249/240/228/207/181 | same width shares | MATCH; empty How it works / Limitations are hidden |

Behaviour checked on the real reflex project (`/projects/reflex`, real R2 video):
- on load: paused, no controls, first frame shown;
- "Try demo": scrolls to the video and plays it with controls;
- at the end: paused, controls hidden, back to the first frame;
- an unknown address shows the not-found page (status 200 + noindex, documented Next.js behaviour when
  the response is already streaming).

Other sizes: 1440 and 1920 centre the 1280 layout; 768 and below stack the sections; no horizontal
scroll at 1920, 1440, 768, 390 or 360. On phones the two buttons are 44 px tall and card text is larger.

D27 (Bek, 2026-11-24): the page is no longer a centred 1280 px column; it fills the width with edges in line with the header (logo x 52). At 1280 the layout is unchanged; at 1440 and 1920 every row widens in its ratio, and the empty space under "At a glance" grows (about 180 px at 1440, 350 px at 1920).
