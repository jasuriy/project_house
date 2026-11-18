# Saqlanganlar and Yoqtirganlarim (screens 3c and 3d)

Built against `docs/design/2026-11-17-screens-mockup.html` screens 3c and 3d (`design-*.png` here).
Checked on the branch servers (backend 8002, frontend 3002, database `projecthouse_test_c2`),
2026-11-18.

| Screen | Design | Ours | Match |
|---|---|---|---|
| Own profile, desktop | design-own-profile-desktop.png | ours-own-profile-1440.png | yes: Profilni tahrirlash + Ulashish, then Saqlanganlar and Yoqtirganlarim; the likes stat beside the project count |
| Own profile, tablet | design-own-profile-tablet.png | ours-own-profile-768.png | yes: the two buttons side by side in the second column |
| Own profile, phone | design-own-profile-phone.png | ours-own-profile-390.png, ours-own-profile-360.png | yes |
| Saved list | design-saved-list-desktop.png / -tablet / -phone | ours-saved-1440.png, -768, -390, -360 | yes: heading, "Faqat siz koʻrasiz", tabs, the feed's cards, newest first |
| Empty list | design-saved-list-phone.png (right) | ours-liked-empty-1440.png | yes: one line on how to fill it, Lentaga oʻtish |

Differences on purpose:

- Desktop side column (274 px inside): Saqlanganlar and Yoqtirganlarim each take a full row. They do
  not fit side by side there; the drawing shows them side by side only because they spill past the
  column's edge.

Flows run in the browser:

- Logged out, /saved -> `/login?next=/saved` -> after login back on /saved.
- Empty Saqlanganlar and Yoqtirganlarim show their empty state.
- Saved three projects in a known order -> /saved lists them last saved first (Server Box,
  Documenso, Apache Superset); liked two -> /liked last liked first. The tab of the open list has
  `aria-current="page"`.
- Own profile shows the two buttons; another person's profile does not; Aziz on Madina's profile
  sees none; Aziz's /saved shows only his own (empty) list, not Madina's.
- Back button: open /saved, open a project, unsave it, press Back -> the list no longer shows it
  (it did before: the browser kept the old page). Fixed with `router.refresh()` after a successful
  like or save. Forward again shows the right liked state; no script errors.
- Sweep: /madina-yusupova, /saved, /liked, /aziz-rahimov x 9 widths (360-1440) x uz/ru/en, while
  loading and after: 108 of 108 with no sideways scroll. Phone tap targets outside cards: none
  under 44 px.
