# Project page: likes, saves, comments, report (screens 2b and 2c)

Built against `docs/design/2026-11-17-screens-mockup.html` screens 2b and 2c (`design-*.png` here).
Checked on the branch servers (backend 8002, frontend 3002, database `projecthouse_test_c2`),
2026-11-18.

| Screen | Design | Ours | Match |
|---|---|---|---|
| Desktop 1440, signed in | design-project-social-desktop.png | ours-1440.png, ours-signed-in-1440.png | yes: comments under Loyiha haqida on the left; heart + Saqlash under the author; Shikoyat qilish ends the links row |
| Tablet 768 | design-project-social-tablet.png | ours-768.png | yes for the page body (one column: media, panel, Loyiha haqida, comments). The header overflows by 33 px when signed in: an older header bug, not from this branch (DEFERRED, see below) |
| Phone 390 / 360 | design-project-social-phone.png | ours-390.png, ours-360.png | yes: heart and Saqlash split the row; no sideways scroll; tap targets 44 px |
| Logged out | design-project-social-phone.png (right) | ours-guest-1440.png | yes: counts shown, "Kiring, izoh yozish uchun." replaces the write box |
| Report dialog | design-project-report-desktop.png | ours-report-1440.png | yes: four reasons, optional note with 0 / 500 counter, Bekor qilish + Yuborish |
| Owner view | (rule in 2b text) | ours-owner-1440.png | yes: no Shikoyat on the own project; Oʻchirish + Shikoyat on others' comments |
| Feed card | screen 1 "214 yoqtirish" | ours-card-likes.png | yes: "1 yoqtirish" in the meta row |

Differences on purpose:

- Saqlash keeps its label when saved; the filled blue bookmark and `aria-pressed` show the state
  (a toggle that also changes its label is read twice by screen readers).
- The drawing's phone frame leaves out result, tech and Loyiha haqida to fit the comments; the page
  shows them.

Flows run in the browser:

- Logged-out heart -> `/login?next=%2Faziz-rahimov%2Fapache-superset` -> after login back on the project.
- Like and save: change at once; after reload still liked/saved; count 0 -> 1.
- Comment: Yuborish disabled while empty; counter "41 / 1000"; two comments -> heading "Izohlar 2"; kept after reload.
- Own comment: Oʻchirish -> "Izoh oʻchirilsinmi?" -> Ha, oʻchirish -> gone (DELETE 204).
- Owner deletes another person's comment (DELETE 204).
- Report project: Yuborish disabled until a reason is picked; focus starts on Bekor qilish; after sending, "Rahmat. Shikoyatingiz yuborildi."
- A fresh guest browser after Madina liked: count 1, not shown as liked (no visitor state leaks between people).
- No console errors after the date fix below.

Found and fixed during the check: React hydration error #418. The comment date was formatted with
`Intl` on the server ("18-noyabr, 2026") and again in Chromium, which has no Uzbek month names
("2026 M11 18"). `formatDate` now uses our own month names in Uzbekistan time (UTC+5), so every
machine prints "18 noyabr 2026". This also changes the published date on project pages from
"17-noyabr, 2026" to "17 noyabr 2026" (the mockup's form).

DEFERRED: the signed-in header at 768 px is 33 px too wide with a long name
("Madina Yusupova" + Sozlamalar + Chiqish), on every page.
