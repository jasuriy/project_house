# Deploy mode: GitHub-only sign-in and the feedback footer

Checked 2026-11-18 on branch servers in deploy mode: backend 8002 with EMAIL_LOGIN_ENABLED=false
(placeholder GitHub keys so the button renders; nothing was sent to GitHub), frontend 3002 built
with NEXT_PUBLIC_EMAIL_LOGIN=false. Not drawn first: these screens only remove parts of drawn
screens (auth mockup) and add a one-line footer.

| Check | Result | Screenshot |
|---|---|---|
| /login | only "GitHub bilan kirish"; no email fields, no "or" divider | ours-login-1440.png |
| /signup | only the GitHub button | ours-signup-1440.png |
| /forgot-password, /reset-password, /verify-email | redirect to /login | - |
| POST /api/v1/auth/signup | 404 email_login_disabled | - |
| /settings | Profil and Ulangan hisoblar; no email section | ours-settings-1440.png |
| Footer | "Fikr va xatolar" -> github.com/jasuriy/project_house/issues/new, new tab | ours-footer-1440/768/390/360.png |
| Sideways scroll on the feed | none at 1440, 768, 390, 360 | - |

Local builds without the flag keep the email forms (both builds were made: `next build` with and
without NEXT_PUBLIC_EMAIL_LOGIN=false).
