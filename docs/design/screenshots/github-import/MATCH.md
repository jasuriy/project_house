# GitHub import: ours vs mockup screens 4a, 4a-2 and 4

Design: `docs/design/2026-11-17-screens-mockup.html` screens 4a (#s-add-step1) and 4a-2
(#s-add-connect), drawn 2026-11-18, captured as `design-add-step1-*.png` and `design-add-connect-*.png`;
step 2 follows screen 4 (`../add-project/mockup-add-*.png`).
Ours (test site, a test account given the GitHub identity of GitHub's public demo account
`octocat`, real GitHub API): `ours-step1-1440/768/390/360.png`, `ours-step1-not-yours-1440.png`,
`ours-connect-1440/390.png` (account without GitHub), `ours-prefilled-1440/768/390.png`,
`ours-edit-not-yours-1440.png`, `ours-settings-connected-1440.png`.

Matches: the two-step bar (current step blue, done step green); the 640 px panel with the link field,
its help text, Continue and "GitHub'siz qo'lda to'ldirish"; the not-connected box with "Sozlamalarda
ulash"; step 2 is screen 4's form with the green banner naming the GitHub account and the relation,
the "GitHub'dan" mark right after each filled label (screen 4's "AI to'ldirdi" badge), and the
read-only licence box next to the GitHub field.

Known differences (intended):

| Where | Mockup | Ours | Why |
|---|---|---|---|
| Steps | 3 (link, details, review and publish) | 2 (link, details) | no review step yet: Publish is on the form |
| Badge text | "AI to'ldirdi" | "GitHub'dan" | the values come from GitHub; AI comes later |
| "AI qaysi tilda yozsin?" | shown | not shown | AI summary comes later |
| Telegram preview | under the card | not shown | spec step 3 |
| Live site | not in screen 4 | its own row under GitHub + Licence | spec field (part 1) |
| Banner | GitHub connected + owner text | also "Boshqa repozitoriy" to go back to step 1 | a way back without reloading |

Checks (browser, real GitHub API, test data): contributor path run for real (a test account linked to
GitHub's `Spaceghost`, a contributor of octocat/Hello-World) -> relation contributor, banner "Siz bu
repozitoriyga hissa qo'shgansiz" (`ours-prefilled-contributor-1440.png`); `https://github.com/octocat/Hello-World.git` accepted
and normalised; import 0.9 s; title "Hello-World", description and canonical link filled, licence
"Ko'rsatilmagan" (the repo has none); apache/superset refused under the field ("not yours"); an
account without GitHub sees the connect box; publishing keeps the canonical link; the edit page shows
the licence row, says "read from GitHub when saved" after the link changes, and refuses someone
else's repo on save with the cursor on the GitHub field; Settings shows "GitHub hisobingiz ulandi."
on `?connected=github`; no horizontal scroll at 1440/768/390/360. The test project was deleted.
