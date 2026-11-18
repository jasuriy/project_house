# Project page: likes, saves, comments, report (screens 2b and 2c)

Built against `docs/design/2026-11-17-screens-mockup.html` screens 2b and 2c (`design-*.png` here).
Checked on the branch servers (backend 8002, frontend 3002, database `projecthouse_test_c2`),
2026-11-18.

| Screen | Design | Ours | Match |
|---|---|---|---|
| Desktop 1440, signed in | design-project-social-desktop.png | ours-1440.png, ours-signed-in-1440.png | yes: comments under Loyiha haqida on the left; heart + Saqlash under the author; Shikoyat qilish ends the links row |
| Tablet 768 | design-project-social-tablet.png | ours-768.png, ours-header-768.png | yes: one column (media, panel, Loyiha haqida, comments); the header shows the photo instead of the name, as the tablet mockup does (fixed here, see below) |
| 1024 | (between the drawn widths) | ours-1024.png | yes: the media column narrows to 577 px so the panel keeps 320 px (fixed here, see below) |
| Phone 390 / 360 | design-project-social-phone.png | ours-390.png, ours-360.png | yes: heart and Saqlash split the row; no sideways scroll; tap targets 44 px |
| Logged out | design-project-social-phone.png (right) | ours-guest-1440.png | yes: counts shown, "Kiring, izoh yozish uchun." replaces the write box |
| Report dialog | design-project-report-desktop.png | ours-report-1440.png | yes: four reasons, optional note with 0 / 500 counter, Bekor qilish + Yuborish |
| Owner view | (rule in 2b text) | ours-owner-1440.png | yes: no Shikoyat on the own project; Oʻchirish + Shikoyat on others' comments |
| Feed card | screen 1 "214 yoqtirish" | ours-card-likes.png | yes: "1 yoqtirish" in the meta row |

Differences on purpose:

- After review, Bek chose the spec's wording: Saqlash turns into "Saqlangan" when saved (filled
  bookmark, blue border). The button has no `aria-pressed`, because its words already say the
  state (ours-saqlangan.png).
- The drawing's phone frame leaves out result, tech and Loyiha haqida to fit the comments; the page
  shows them.
- Comment dates are absolute ("18 noyabr 2026"), not relative as drawn ("2 kun oldin"): an
  absolute date prints the same on the server and in the browser; relative text changes with the
  clock and would bring back the hydration mismatch fixed below.

Flows run in the browser:

- Logged-out heart -> `/login?next=%2Faziz-rahimov%2Fapache-superset` -> after login back on the project.
- Like and save: change at once; after reload still liked/saved; count 0 -> 1.
- Comment: Yuborish disabled while empty; counter "41 / 1000"; two comments -> heading "Izohlar 2"; kept after reload.
- Own comment: Oʻchirish -> "Izoh oʻchirilsinmi?" -> Ha, oʻchirish -> gone (DELETE 204).
- Owner deletes another person's comment (DELETE 204).
- Report project: Yuborish disabled until a reason is picked; focus starts on Bekor qilish; after sending, "Rahmat. Shikoyatingiz yuborildi."
- Unlike and unsave: count 1 -> 0, both not pressed, still so after reload.
- Report a comment (Dilshod's, as Madina): database row target_kind=comment, comment_id set,
  project_id 29, snapshot = the comment text, reason spam.
- Roll back: with the like/save calls forced to fail (500), heart and Saqlash went back to how they
  were; a failed comment POST showed "Nimadir xato ketdi. Qayta urinib koʻring.", kept the text in
  the box and left the count unchanged.
- A fresh guest browser after Madina liked: count 1, not shown as liked (no visitor state leaks between people).
- No console errors after the date fix below.

Found and fixed during the check: React hydration error #418. The comment date was formatted with
`Intl` on the server ("18-noyabr, 2026") and again in Chromium, which has no Uzbek month names
("2026 M11 18"). `formatDate` now uses our own month names in Uzbekistan time (UTC+5), so every
machine prints "18 noyabr 2026". This also changes the published date on project pages from
"17-noyabr, 2026" to "17 noyabr 2026" (the mockup's form).

Older layout bugs found by a sweep (3 pages x 9 widths 360-1440 x uz/ru/en x signed in and out,
measured while loading and after) and fixed here, as Bek chose:

- Signed-in header at 768 px was 33 px too wide with a long name ("Madina Yusupova" + Sozlamalar +
  Chiqish), on every page. From 768 to 1023 px it now shows the person's photo (linked to their
  profile, labelled with their name), as the tablet mockup does; the name is back from 1024 px.
- Project page at 1024-1130 px scrolled sideways (up to 93 px): the media column was a fixed 768 px.
  It is now at most 768 px and the panel at least 320 px; at 1280 px and up nothing changes
  (768 + 480 px at 1440).
- Phone header at 360 px was 17 px too wide for a moment while the account loaded: the placeholder
  was 112 px, the real icons 92 px. The placeholder is now 92 px on a phone.

After the fixes: 162 of 162 checks with no sideways scroll.
