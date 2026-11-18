# Add project: ours vs mockup screen 4

Design: `docs/design/2026-11-17-screens-mockup.html` (#s-add), captured as `mockup-add-desktop.png`,
`-tablet.png`, `-phone.png` (recaptured after the UTF-8 fix, 2026-11-18).
Ours (test data, logged in as a developer, Uzbek): `ours-add-empty-1440.png`,
`ours-add-filled-1440.png` / `-768.png` / `-390.png`, `ours-add-error-390.png` (a Vimeo link ->
error under the video field, cursor moved there), `ours-add-company-1440.png` (company account),
`ours-header-768.png` / `-1024.png` / `-1440.png`, `ours-published-1440.png` (after Publish).

Matches: page title 24 px; form panel left and the feed-card preview right (360 px, sticky) on
desktop, preview below the form on tablet and phone; field order and labels (name, problem with
help, description box, result + role side by side, video link with help, images drop zone with the
dashed border and "+" tile, tech chips with x, field picker, GitHub); required stars; the button row
under a divider; header "Loyiha qo'shish" button (mockup desktop), "+ Qo'shish" (mockup tablet),
plus icon on phone.

Known differences (intended):

| Where | Mockup | Ours | Why |
|---|---|---|---|
| Steps bar, GitHub banner, "AI to'ldirdi" badges, "AI qaysi tilda yozsin?" | shown | not shown | GitHub import and auto-fill are part 2 |
| Licence field | "MIT (GitHub'dan olindi)" | "Jonli sayt" (live site) in that slot | licence is read from GitHub in part 2; live site is a spec field |
| Buttons | Bekor qilish + Davom etish (step 3 follows) | Bekor qilish + E'lon qilish | one page in part 1, no review step |
| Telegram preview | under the feed card | not shown | Telegram/Open Graph preview is spec step 3 |
| Phone bottom bar | fixed bar with Davom etish + Ko'rish | buttons at the end of the form | no step 3 to preview yet |
| Paired fields | role box lower than result box (mockup quirk) | boxes aligned at the top | fields keep their content at the top |
| Image tiles | plain 16:9 thumbnails, 6 per row | move-left, move-right and remove buttons; on a phone 2 per row in 4:3 so each button is 44 px (`ours-images-390.png`) | the order and removal need controls and phone tap size |
| Phone header | (screen 4 phone has its own top bar) | logo, language, +, settings; logout is at the bottom of Settings on phones (`ours-settings-logout-390.png`) | a 360 px phone has no room for a fifth item; no horizontal scroll |

Checks: a 4.5 MB, 12 MP phone JPEG stored sideways with an EXIF rotation tag went browser -> 3002 ->
8002 (201) and was stored as an upright 1200x1600 WebP (`ours-published-phone-photo-1440.png`, red band
on top); a tag typed without Enter is saved on Publish; image and tag buttons are 44x44 at 390 and do
not overlap; removing a tile frees its upload (DELETE 204); no horizontal scroll against the visible
width (scrollbar excluded) at 360/390/768, logged in and out, uz/ru/en; double click on Publish sends one request; publishing opens the new project page; two
uploaded images appear in order; the Vimeo link gets the video error under its field; a company
sees the explanation and no header button; logged out `/new` -> 307 to `/login?next=/new`; no
horizontal scroll at 390 in uz/ru/en on `/new` and `/`; header add button one line at 768/1024/1440
in all three languages. Feed (`../feed/ours-1440.png`): Apache Superset now shows a screenshot
instead of the grey mp4 placeholder (new cover rule).
