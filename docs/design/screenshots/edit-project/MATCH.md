# Edit and delete: ours vs mockup screens 4b and 4c

Design: `docs/design/2026-11-17-screens-mockup.html` screens 4b (#s-edit) and 4c (#s-edit-delete),
drawn 2026-11-18, captured as `design-edit-*.png` and `design-edit-delete-*.png` (desktop, tablet,
phone).
Ours (test data, Uzbek): `ours-project-owner-1440.png` (owner sees Tahrirlash), `ours-edit-1440.png`
/ `-768.png` / `-390.png`, `ours-delete-dialog-1440.png` / `-390.png`, `ours-sample-owner-1440.png`
(a sample: O'chirish only).

Matches: title "Loyihani tahrirlash" with the note that the address does not change; the add form
filled with the project; O'chirish on the left of the footer, Bekor qilish and Saqlash on the right;
the dialog names the project, "Yo'q, qoldirish" and the red "Ha, o'chirish" side by side on desktop,
the red button first and full width on phone.

Known differences (intended):

| Where | Drawing | Ours | Why |
|---|---|---|---|
| Dimmed area | the page body only | the whole window, header included | the browser's dialog backdrop covers everything (and blocks clicks behind it) |
| Edit form fields | a shortened set | the full add-project field set | the same form as Add project |
| Phone footer | fixed bar with Saqlash + Bekor qilish | buttons at the end of the form, O'chirish full width above them | same as the add page (no fixed bar in part 1) |
| Address note | full domain | `username/slug` | the domain is not known yet (deploy) |
| Owner actions on the project page | not drawn | "Tahrirlash" link (own project) or "O'chirish" (sample) after Ulashish in the links row | follows the existing links-row style |

Checks (browser, test data): owner sees Tahrirlash on their project page; the form opens filled with
both images; saving a new title and removing an image keeps the address and shows the change; logged
out `/<user>/<slug>/edit` -> 307 to login with `next`; another user's edit address -> 404; a
sample's edit address -> 404 and its page shows O'chirish only; Esc closes the dialog; a double click
on "Ha, o'chirish" sends one DELETE; after deleting, the owner lands on their profile and the
project is gone (404); a server error on save (empty title) shows under the field with the cursor there and the dialog closed; no horizontal scroll on the edit page at 1440 / 768 / 390.
