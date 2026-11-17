# Onboarding page: drawing vs build

Drawing: `docs/design/2026-11-18-auth-mockup.html`, screen 8. Checked by the advisor.

| Screenshot pair | Result |
|---|---|
| `design-onboarding-desktop.png` vs `ours-onboarding-1280.png` | logged-in header, "Xush kelibsiz, Aziz!", sub line, blue confirm-email note, "Loyihalarni koʻrish" and "Sozlamalar" |
| `design-onboarding-phone.png` vs `ours-onboarding-390.png` | same card without the note (email already confirmed) |

Flows: a new email sign-up lands on `/onboarding?verify=1` with the note; a user whose email is confirmed
never sees the note, even with `?verify=1`; logged-out visitors go to the login page.

Known differences (accepted):
- Phone header shows the settings icon next to "Chiqish" (the shared header; the drawing simplified it).
- Header right-hand group about 8 px further left (44 px touch areas), as on every page.
