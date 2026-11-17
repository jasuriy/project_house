# Forgot, reset and verify-email pages: drawing vs build

Drawing: `docs/design/2026-11-18-auth-mockup.html`, screens 5-7 (drawn 2026-11-18; Bek: undrawn pages
are drawn and built directly, the advisor comparison is the gate).

| Screenshot pair | Result |
|---|---|
| `design-forgot-desktop.png` vs `ours-forgot-1280.png` | same card, title, sub line, Email field with the "siz@example.com" placeholder, button, footer |
| `design-forgot-sent-phone.png` vs `ours-forgot-sent-390.png` | green banner, filled email, "Qayta yuborish" |
| `design-reset-desktop.png` vs `ours-reset-1280.png` | same; focused field shows one box with the primary border and 3 px halo, eye inside |
| `design-reset-done-phone.png` vs `ours-reset-done-390.png` | green banner, "Kirish" button |
| `design-reset-expired-phone.png` vs `ours-reset-expired-390.png` | yellow banner, "Yangi havola olish", footer |
| `design-verify-desktop.png` vs `ours-verify-1280.png` | logged-in header, green banner with the email, "Lentaga oʻtish" and "Sozlamalar" |
| `design-verify-failed-phone.png` vs `ours-verify-failed-390.png` | yellow banner (the drawing also shows "Kirish"; a logged-in visitor does not get it, see below) |
| `design-verify-needs-login-phone.png` vs `ours-verify-needs-login-390.png` | login card with the blue note above the provider buttons |

Flows checked in the browser (test database): forgot shows the same message and the button turns into
"Qayta yuborish"; the reset link opens with the token removed from the address bar and
`referrer: no-referrer`; a new password saves, "logged out everywhere" shows, the same link again shows
"Havola eskirgan", the new password logs in; verify while logged in confirms and shows the email; the
same link again fails; logged out, the link goes to the login page with the blue note and, after
logging in, confirms by itself (`email_verified: true`); no token shows "havola topilmadi". After a
successful confirm the address is `/verify-email` with no token. Switching language on the reset page,
the verify page and the login detour never brings the token back into the address bar; the reset form
keeps working (token from sessionStorage) and a confirmed page stays confirmed after the switch.

Known differences (accepted):
- Typed test values differ from the drawing's sample text.
- Header right-hand group about 8 px further left (44 px touch areas), as on every page.
- The failed verify state shows the "Kirish" button only to visitors who are not logged in (a logged-in
  visitor is already in an account; the hint text tells them to switch account).

Found and fixed while comparing: the site-wide focus ring was drawn on the input inside the field box
(the eye sat outside the ring); inputs in a field box now leave focus to the box. After a successful
confirm, router.refresh() put the token back into the address bar; the page now navigates to the clean
address instead. The forgot email field lacked the drawn placeholder (added). Switching language after
a successful confirm showed "the link did not work" (the page re-rendered without a token); a logged-in
user whose email is verified now sees the confirmed screen.
