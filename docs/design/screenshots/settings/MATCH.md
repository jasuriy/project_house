# Settings page: drawing vs build

Drawing: `docs/design/2026-11-18-auth-mockup.html`, screen 9. Checked by the advisor.

| Screenshot pair | Result |
|---|---|
| `design-settings-desktop.png` vs `ours-settings-1280.png` | 640 px card, "Sozlamalar", Email with the green "Tasdiqlangan" badge, divider, "Ulangan hisoblar" with Google "Ulangan" and GitHub "Ulash"; "Sozlamalar" is the active header link |
| `design-settings-unverified-phone.png` vs `ours-settings-unverified-390.png` | blue "Tasdiqlanmagan" badge, the blue note with the password-reset link, both "Ulash" buttons blocked |
| `design-settings-error-phone.png` vs `ours-settings-error-390.png` | yellow "Bu GitHub hisobi boshqa hisobga ulangan." banner |

Flows: logged out, `/settings` redirects to `/login?next=/settings`; "Ulash" is a full-page link to
`/api/v1/auth/oauth/<provider>/start` and only appears for providers that are switched on and not yet
connected; the verify page's "Sozlamalar" button opens this page; every `?error=` code shows its own
banner. The "Google connected" state used a fixture row in the test database (a real Google login
cannot run here).

Known differences (accepted):
- The Google row shows no email under the name: `/me` returns the provider names only.
- The unverified phone wraps the badge under the email because the test email is longer than the drawing's.
- Header right-hand group about 8 px further left (44 px touch areas), as on every page.
