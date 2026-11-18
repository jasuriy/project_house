# Edit profile: ours vs drawing (auth mockup screen 10)

Design: `docs/design/2026-11-18-auth-mockup.html` screen 10, captured as `design-edit-desktop.png`
(developer), `design-edit-error-phone.png` (GitHub link error), `design-edit-company-phone.png`
(company, saved banner).
Ours: `ours-edit-1440.png` (developer), `ours-edit-error-390.png` (after saving
`https://gitlab.com/aziz`), `ours-edit-company-390.png` (company after a save),
`ours-edit-about-focus-1440.png` (About box focused), `ours-settings-with-profile-1440.png`.

Matches: 640 px card, title 24 px with "Profilingizni ko'rish" link, sections Asosiy / Haqida /
Havolalar with 17 px headings and dividers, labels, help texts, required star on Ism, open-to-work
checkbox with its note, About box with the counter, link fields, the error under the GitHub field
with the red border, Saqlash (full width on phone), company variant (Lavozim, Kompaniya nomi,
Kompaniya haqida, Kompaniya sayti; no open-to-work, GitHub or LinkedIn).

Known differences (intended):

| Where | Drawing | Ours | Why |
|---|---|---|---|
| Settings page | screen 9 has no profile row | a "Profil" section with "Profilni tahrirlash" and "Profilingizni ko'rish" above Email | the phone header hides the name, so this is how a phone user reaches their profile (design doc) |
| About box corner | none | the browser's resize grip | the box can be made taller |
| Empty site field | grey "https://" placeholder | same placeholder | as drawn |

Checks (browser, logged in): double click on Saqlash sends one PATCH; "Saqlandi." appears; the
profile shows the new headline; a gitlab.com link gives the GitHub error under that field with
aria-invalid; no horizontal scroll at 390; a company account has no developer fields; About box
focus shows one ring (the box), not two; logged out `/settings/profile` -> 307 to
`/login?next=/settings/profile`.

## Profile photo (2026-11-18, add-project part 1)

Drawing: screen 10 now has a "Profil rasmi" row at the top. Ours: `ours-edit-photo-1440.png` /
`-390.png`; the profile with the photo: `../profile/ours-photo-1440.png` (also on every card of that
person and next to the author on the project page).
Checks (browser): upload -> button turns into "Rasmni almashtirish" and "Olib tashlash" appears;
the photo shows on the profile, the person's 4 cards and the project page; a GIF is refused before
upload with the invalid-image message; "Olib tashlash" clears it and the old file answers 404; no
horizontal scroll at 390. Backend: stored as a 512 x 512 WebP; replacing deletes the old file;
company accounts may have a photo.
