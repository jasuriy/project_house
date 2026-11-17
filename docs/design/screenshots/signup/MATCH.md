# Signup page: drawing vs build

Drawing: `docs/design/2026-11-18-auth-mockup.html`, screen 3 (approved by Bek 2026-11-18).
Compared by screenshots and computed styles; checked by the advisor.

| Screenshot pair | Result |
|---|---|
| `design-signup-desktop.png` vs `ours-signup-1280.png` | same blocks in the same order and sizes: title, sub line, "davom etish" buttons, divider, account-type cards (Dasturchi selected: primary border, accent-soft fill, radius 10, padding 12/14), fields with red stars and help texts, `projecthouse.uz/` prefix running straight into the username, red "Bu nom band" error under it, button, footer |
| `design-signup-phone.png` vs `ours-signup-390.png` | match; nothing sticks out of the card |
| `ours-signup-1280-empty.png` | the empty form (username shows its rule as help text) |
| `ours-signup-1440.png` | the same card centred on a wider screen |

Known differences (accepted):
- The header's right-hand group sits about 8 px further left: the "Kirish" link has a 44 px touch area (same as on login and every page).
- Typed test values differ from the drawing's sample text (`aziz.new@example.com`, `login-check`).
- The drawing's desktop frame sits 8 px further right in its screenshot (screenshot framing, not layout).
- After a successful sign-up the browser goes to the feed until the onboarding page exists (then `/onboarding?verify=1`).

Found and fixed while comparing: on phones the username input's default width made the whole card
column wider than the card (inputs and buttons stuck out); the input now has a zero base width.
