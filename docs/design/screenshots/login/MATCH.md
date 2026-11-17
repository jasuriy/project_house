# Login page: drawing vs build

Drawing: `docs/design/2026-11-18-auth-mockup.html` (approved by Bek 2026-11-18). Compared by
screenshots and computed styles; checked by the advisor.

| Screenshot pair | Result |
|---|---|
| `design-login-desktop.png` vs `ours-login-1280.png` / `ours-login-1280-focus.png` | card, title, provider buttons, divider, labels, inputs, eye, forgot link, button, footer within about 1 px; focused input has the primary border and the 3 px accent-soft halo |
| `design-login-error-phone.png` vs `ours-login-error-390.png` | match within 1-2 px |
| `design-login-account-exists-phone.png` vs `ours-login-account-exists-390.png` | text and placement match |
| `ours-login-1440.png` | the same card centred on a wider screen |

Known differences (accepted):
- "Lenta" sits about 6 px further right: its link has a 44 px touch area (same as on every page).
- Phone: the language button ends 24 px from the right edge instead of 16 px (the empty user slot keeps its gap when its links are hidden on the login page).
- Provider buttons only show when Google/GitHub login is switched on; the screenshots ran with both on.
