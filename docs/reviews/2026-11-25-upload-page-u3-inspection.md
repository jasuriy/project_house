# U3 upload page: design and logic inspection

Date: 2026-11-25. Read-only. Twins at http://127.0.0.1:8765/ (u3-empty, u3-filled, u3-error, u3-repo, final-D6).
Sources: `build_u3.py` (cited as `b:line`), `U3/plan.md`, D6 `D6/project/Main.dc.html` (cited as `D6:line`),
and the live app for backend rules. Screenshots are in
`d:\techsphere_bek\personals\loyihalar\project_house\.playwright-mcp\u3-insp\` (cited by file name).
Guidelines are from the ui-ux-pro-max skill (`references/quick-reference.md` rule ids, or ux search results).

## Summary

The five most damaging problems:

1. Long values are cut off. The title, description and Requires are single-line `<input>`s, so a 34-character name or a 140-character description is clipped, where D6 wraps it. The story and terminal show 8 and 7 lines, where D6 cuts at 5 and 6 (finding 1).
2. Two controls have no visible keyboard focus: the empty terminal and "Replace video" (finding 2).
3. The geometry promise depends on `field-sizing:content`. In Safari before 26.2 and Firefox before 152, U2's 199px ident card comes back (finding 3).
4. On phone, pressing Render with a missing field gives no visible feedback, because the readiness count is hidden and the error is about 1700px below the button (findings 6 and 7).
5. Placeholders read as real values ("1 pip install ...", "Requires Python 3.11+, Node 20"), and the dashed cue is 2.43:1, so on touch an empty field looks filled (findings 5 and 12).

Verdict per question:

| Q | Verdict | Findings |
|---|---------|----------|
| 1 First-time user, desktop and touch | Partly. The ghosts say where to act, but several empty fields look filled, the drop copy means nothing on touch, and nothing marks what is required. | 5, 12, 14, 6 |
| 2 Duplicate or jobless elements | Yes. The readiness bar duplicates the ghosts on desktop and is hidden on phone. "One command per line" repeats the gutter. Change and the pencil do the same job. The story segments become a second progress meter. | 7, 5, 9, 13, 14 |
| 3 Editing cues consistent | No. There are five hover treatments and two focus-ring styles, and hover weakens the cue on text fields. | 8, 2 |
| 4 Repository state set | It covers the four required cases but is not implementable as drawn: two backend failures and a Cancel are missing, and the field jumps between states. | 10 |
| 5 Accessibility | There are faults: focus loss, focus order on phone and tablet, dashed outlines below 3:1, a readiness bar that is silent to screen readers, a label-in-name failure, and 20px touch targets. | 2, 4, 7, 11, 12 |
| 6 D6 type scale, spacing, colour | The type scale matches, except the header button at 15px. U3 adds 11 colours, a 6px radius, and 3/6/10/20px gaps. | 15 |

## Findings

### 1. [BLOCKER] Long values: single-line fields clip where D6 wraps; multi-line fields hide where D6 cuts

- Element: `#name`, `#short_description`, `#requirements`; also the story textareas and the terminal (u3-filled).
- What is wrong: these are `<input type="text">` (b:147, b:149, b:195), but D6 prints them as wrapping text (`.title{overflow-wrap:anywhere}` D6:67, `.desc` D6:70, `.req` is a wrapping flex row). Their maxlengths are 80, 160 and 300.
- Evidence [V]: at 1440x900 I set realistic values in the twin: name "Realtime Defect Detection Pipeline" (34 chars), a 140-char description, and Requires "Python 3.11+, CUDA 12.1, an NVIDIA GPU with 8 GB of memory, Docker 24". Measured scrollWidth/clientWidth: name 652/429, description 1080/429, Requires 452/257. All three are clipped. Screenshot `long-values-1440.png` shows "Realtime Defect Detect", "...car body panels from li" and "NVIDIA GPU w". The caller's "filled equals D6" check used "Reflex" and a 24-char description, which never reach this case.
- The multi-line fields have the opposite mismatch [V]:
  - Story: a 585-char "The problem" shows 8 lines with an inner scroll (scrollHeight 458 vs clientHeight 188, b:236), and the story card grows from 153 to 265px. D6 clamps story text at 5 lines with "more", so the author cannot see where the published page will cut.
  - Terminal: 7 commands show 7 lines, while D6 caps the terminal at 6 lines.
  - The gutter is a separate column (b:193), so its numbers need a script to stay in sync with the line count and the scroll position.
  - Screenshot `long-story-terminal-1440.png`.
- Why it matters: the author cannot see what they typed, and the editor stops looking like the page it produces for ordinary data.
- Fix (keeps D6 geometry):
  - Title and description: use `<textarea rows="1">` with the same `.ed` styling, `field-sizing:content` plus a JS height fallback (see finding 3), `overflow-wrap:anywhere`, and Enter suppressed so each stays a single value. Empty height stays one line, exactly as now.
  - Requires: use the same `rows="1"` textarea with `flex:1` so it wraps like D6's `.req` text. Move "+ Limitations" off this row (see finding 14).
  - Story and terminal: cap the editor at D6's limits (5 story lines, 6 terminal lines) and draw a faint rule where the published page will cut, or show the 5-line clamp with "more" exactly as D6 does once the field loses focus.

### 2. [BLOCKER] The empty terminal and "Replace video" show no keyboard focus

- Element: `.term-w` while empty (u3-empty); `label.vrep` "Replace video" (u3-filled).
- What is wrong:
  - Terminal: `.term-w:has(.term-in:placeholder-shown)` (b:298) has specificity (0,3,0), which beats `.term-w:focus-within` (b:299, (0,2,0)). While the terminal is empty, focus keeps the 1px dashed `#A39EEC` outline at 2.43:1.
  - Replace video: the focusable element is the 1x1 sr-only file input (b:94, `.sr` b:203). The `:has(+ input:focus-visible)` ring exists only for the empty slot (b:262), so the filled state's "Replace video" never shows focus.
- Evidence [V]:
  - Terminal: Tab walk after a 350ms settle. With `#getting_started` focused, the wrapper's computed outline is `dashed rgb(163,158,236)`. Screenshot `focus-terminal-empty.png` shows no ring.
  - Replace video: with `#video` focused on u3-filled, `.vrep` outline is `none` and box-shadow is `none`. Screenshot `focus-replace-video.png`.
- Guideline: `focus-states` ("Remove focus outline without replacement" is the anti-pattern); WCAG 2.4.7 (AA).
- Fix:
  - Terminal: replace b:299 with `.term-w:has(.term-in:focus-visible){outline:2px solid #4F46E5;outline-offset:2px}` placed after b:298. Same specificity, later rule wins.
  - Replace video: add `.video:has(+ input:focus-visible) .vrep{outline:2px solid #4F46E5;outline-offset:2px}`.
  - Neither change touches geometry.

### 3. [MAJOR] D6 geometry depends on `field-sizing:content`; without it U2's layout returns

- Element: title, every `select` pill, Requires, story and terminal textareas (b:229, b:234, b:243, b:294, b:306).
- Evidence:
  - [V] MDN browser-compat-data `css/properties/field-sizing.json` (https://raw.githubusercontent.com/mdn/browser-compat-data/main/css/properties/field-sizing.json) gives version_added Chrome 123, Firefox 152, Safari 26.2. The MDN page says "Baseline 2026, newly available since June 2026 ... might not work in older devices or browsers".
  - [V] I injected `*{field-sizing:fixed !important}` at 1440x900 to simulate an older browser:
    - The ident card grew from 163 to 199px. That is U2's height, row 5 of plan.md's table.
    - The tags wrapped under the title (y 101 to 145).
    - The type pill went from 68 to 93px wide and the category pill from 124 to 163px (a select sizes to its widest option, "AI & Machine Learning").
    - Status and License values moved 20px and 9px.
    - Every card below the ident card moved down 36px.
  - Screenshots: `fieldsizing-fixed-filled-1440.png`, `fieldsizing-fixed-empty-1440.png`.
- Why it matters: anyone on an iPad or Mac that is not on Safari 26.2 yet sees the "form of boxes" that U3 was built to remove.
- Fix:
  - Do not size selects by their options. Render the chosen label as a visible `<span>` (the pill), and lay the `<select>` over it with `position:absolute;inset:0;opacity:0;width:100%`. The pill then sizes to its text in every browser, and this also fixes finding 11's dead zones.
  - For the text fields, add a small autosize script (set `style.height` and `style.width` from `scrollHeight` and `scrollWidth` on input) behind `@supports not (field-sizing:content)`.

### 4. [MAJOR] Below 1100px the keyboard and screen-reader order jumps around the page

- Element: whole page at 390 (and at any width up to 1100).
- What is wrong: D6 reorders the cards visually with CSS `order` (D6:136: ident 1, video 2, story 3, byline 4, ...), but the DOM order is still video, byline, story, ident (b:349-357). On D6 this mattered little; in an editor with 20 tab stops it decides the whole flow.
- Evidence [V], Tab walk on u3-empty at 390x844, page y of each focused element:
  - Render 4
  - video 253
  - repo 962
  - problem 527, how 666, result 806
  - title 85, type 123, description 153, You get 193
  - Status 1054, Timeline 1119, License 1054
  - languages 1224, terminal 1377, Requires 1505
- Guideline: `keyboard-nav` ("Tab order matches visual order"); WCAG 2.4.3 and 1.3.2.
- Fix: a single grid with named areas would not keep D6's geometry. D6 stacks two independent columns of unequal card heights, and a shared grid lines its rows up across them. The phone DOM order would also make desktop Tab zigzag [D]. The options:
  - (a) `reading-flow:flex-visual` on `.cols` inside the max-width:1100px rule. Zero geometry, but BCD (`css/properties/reading-flow.json`) lists Chrome 137 only, with Firefox and Safari false [V]. On its own it fixes Chromium only.
  - (b) Render the narrow order in the DOM only below 1100px. In the React app, choose the card order from a container or media-query hook, with stable keys so nodes are moved, not remounted. Desktop keeps today's DOM and geometry. Risks [A]: a first-paint mismatch under server rendering, and lost focus if the breakpoint is crossed mid-edit (a rotating tablet).
  - (c) Make the phone visual order follow the DOM (video first). That changes D6's approved phone layout.
  - Recommended: (b), with (a) added since it costs nothing.
- Owner decision: if (b) is too costly, may the phone layout start with the video instead of the title (option c)? Recommended: no. Keep D6's order and pay for (b).

### 5. [MAJOR] Placeholders read as real values; hints and copy repeat or mislead

- Element: terminal, Requires, "One command per line", the video slot copy.
- What is wrong:
  - The terminal placeholder "pip install -r requirements.txt" sits next to a real gutter number "1" (`n = max(1, ...)` at b:186), so an empty terminal looks like a one-line script.
  - The Requires placeholder "Python 3.11+, Node 20" (b:195) completes the sentence "Requires Python 3.11+, Node 20".
  - Placeholder `#6E6C88` against typed `#17162F` differs by only 3.49:1 [V].
  - In the error state the red box surrounds that placeholder, so it reads as "your value is wrong". The message gives a different example, "Required, for example Python 3.11+" (b:189). Screenshot `error-1440.png`.
  - "One command per line" (b:192) repeats the gutter numbers and the textarea's aria-label. It stays in the filled state, where D6 has "Copy commands", so that is one place where the filled page differs from D6 [V] (`filled-1440.png`).
  - "Drop an MP4 or WebM here" (b:85) is the only instruction on a phone, where there is nothing to drop (`empty-390.png`).
- Guideline: `input-helper-text`, `empty-states`; ux search "Placeholder Content" (use realistic data, which these are; the problem is that nothing marks them as examples).
- Fix:
  - Terminal: hide the gutter while the textarea is `:placeholder-shown`. Make the placeholder two example lines in a comment style, "# one command per line" and "pip install -r requirements.txt". Delete the header hint, and leave that header slot empty as on D6.
  - Requires: placeholder "e.g. Python 3.11+". Error message "Add what it needs to run, e.g. Python 3.11+", one example used everywhere.
  - Video: "Drop an MP4 or WebM here, up to 300 MB" on pointer devices; "MP4 or WebM, up to 300 MB" under `@media (hover:none)`.

### 6. [MAJOR] What happens after a failed Render is not specified; on phone it is invisible

- Element: Render project, error states (u3-error, repo `unchecked`).
- What is wrong:
  - The error message is plain in-flow text with no `role="alert"` or live region (b:189, b:114).
  - No design says whether focus moves or the page scrolls to the first invalid field.
  - The header bar only goes from 6 to 5 segments, with no colour or text naming the part.
  - On phone the readiness text is hidden (b:313), Render is at y=4, and the error is at about y=1700 of a 1751px page [V] (`error-390.png`). Pressing Render therefore changes nothing on screen.
- Evidence: [V] source lines above and the measured page height; behaviour [D], since the twin has no script.
- Guideline: `error-placement`, `submit-feedback`; ux search "Focusable Error Summary" (move focus after a failed submit).
- Fix: specify this rule: on a failed Render, scroll the first invalid field to the centre, focus it, and give its message `role="alert"`. When more than one field is missing, the header count becomes a link to the first one (see finding 7). No geometry change.

### 7. [MAJOR] The readiness bar duplicates the ghosts on desktop, is hidden on phone, and is silent

- Element: "0 of 6 ready" plus 6 segments (b:64-77, CSS b:208-212).
- What is wrong:
  - On desktop all six parts and their ghosts fit on one unscrolled screen (caller's measurement), so the bar adds only the count. The segments carry no labels; which segment is which exists only in `title` tooltips (b:66), which are hover-only and on 16x4px targets.
  - It is hidden at 640px and below (b:313, "the empty slots show what is left"). That is exactly where the slots do not fit on one screen (1566px page [V]), so the logic is backwards.
  - To-do segments are `#E3E2EC` on white, 1.28:1 [V], so "0 of 6" reads as an empty strip.
  - It is not a live region, so finishing a part is not announced [V].
  - What makes a part "ready" is undefined. The twin only knows all-or-nothing (b:58-61). The backend does not require Timeline or How it works (`backend/app/catalog.py:91-104`) [V], so "Facts" and "Story" need a written rule.
- Guideline: `multi-step-progress`, `contextual-live-badge-updates`, `hover-vs-tap`, `color-contrast`.
- Fix: keep the text, drop the six segments.
  - Desktop: "4 of 6 ready" as a text button that focuses the first missing part.
  - Phone: keep it visible (for example "4/6" before Render).
  - Wrap the text in `role="status"` and announce "Story ready, 5 of 6".
  - Write the six-part field map into plan.md.
- Owner decision: keep a visual bar at all? Recommended: no. A count that jumps to the next missing part does the job; six unlabeled dashes do not.

### 8. [MAJOR] Hover and focus cues are not one system, and hover weakens the cue on text fields

- Element: every empty and editable control (u3-empty).
- Evidence [V], computed after hover with a 350ms settle:

  | Control | Hover result |
  |---------|--------------|
  | Text fields (`.ed`: description, story, Requires) | dashed `#A39EEC` (2.43:1) becomes solid `#D9D8E6` (1.41:1) on `#FAFAFD` |
  | Selects and Timeline | solid `#B9B7CE` (1.96:1), no tint, text unchanged |
  | Ghost pills and repo | solid `#4F46E5` on `#F7F7FE`, text darkens |
  | Video slot | dashed `#4F46E5` on `#FBFBFF` |
  | Terminal | nothing |
  | Limitations | `#F1F0FD` tint |

  Rules: b:224, b:246, b:254, b:261, b:309.
- Focus has two styles. Text fields get a 1px ring plus a 3px 16% halo at offset -1 (b:225). Everything else gets D6's 2px ring at offset 2 (D6:20). Empty Status and License get offset 1 because `.sel-ed.fv-ed.empty` (b:249) out-specifies the focus rule.
- Why it matters: hovering a text field makes it look less editable than before, and the page signals "editable" in five dialects.
- Guideline: `focus-states`, ux "Hover States" (subtle but consistent change).
- Fix:
  - One hover for every empty or editable slot: 1px solid `#4F46E5` outline plus D6's tint `#F5F5FA` (D6's `.btn2:hover`).
  - One focus: 2px solid `#4F46E5` everywhere. Offset -2px on `.ed` boxes, so the ring sits inside their padding and does not reach the description box 2px below the title; offset 2px on pills and buttons. Drop the halo.
  - All of these are outlines, so geometry is unchanged.

### 9. [MAJOR] The same job, "change a picked list", has four different controls

- Element:
  - You get: a 28px round pencil, icon only (b:142).
  - Built with: a "Change" text button (b:173-174).
  - Repository: click the indigo button itself, with no cue (b:103).
  - Video: "Replace video" (b:92).
- Evidence [V]:
  - The pencil and "Change" are on screen together in `filled-1440.png`.
  - On phone the pencil stays 28x28, while "Change" becomes 44px tall through D6's phone rule (D6 `.copy{height:44px}`) (`error-390.png`).
  - The linked repo button is pixel-identical to D6's link, which on D6 opens GitHub. Here it opens the edit field, and only its aria-label says so.
- Why it matters: the author has to learn a different gesture per card, and "Remove repository" is undiscoverable.
- Fix:
  - One idiom for list edits: the round pencil (`.editchip`, 28px, `var(--chip)`). Use it after the last chip for You get and at the right of the Built with header in place of "Change". It fits the space of about 60px left in the You get row, which "Change" (73px) does not [D: the pencil sits at x=1315, the card's content edge is at 1367].
  - Add the same pencil left of the linked repo button.
  - On phone give the pencil a 44px hit area with `::before{inset:-8px}`.

### 10. [MAJOR] Repository states: the required four are covered, but the set is not implementable as drawn

- Element: u3-repo board (b:97-115, b:364-373).
- Covered [V]: optional ("optional" in the ghost), typed but unchecked blocks Render, not found or private (one message, which matches the backend's single `repo_not_found`, `backend/app/projects/service.py:93`), and remove (the change state).
- Missing or wrong:
  - a. The backend has two more failures: `repo_url_invalid` (422, "Use a link like https://github.com/owner/repo") and `github_unavailable` (502, "GitHub did not answer, try again") (`service.py:86-91`) [V]. U3 has no state for either. The second needs a Retry, not "Check the name".
  - b. The change state has Save and Remove but no Cancel (b:110-111), so there is no way out unchanged. Whether Save goes through Checking and Not found, and what Render does while a linked repo is being edited, is undefined.
  - c. The field jumps sideways between states, because the row is right-aligned and the action group changes width. Field x is 925 when typing, 938 when checking, 925 when not found, and 905 in change [V]. This breaks rule 1.
  - d. "Link" is enabled on an empty field (typing-empty) [V, no `disabled`].
  - e. The message has no live region (b:114) [V].
  - f. The copy says "or clear the field", but the visible control is "Cancel" (b:105). The placeholder "github.com/owner/repository" differs from the backend's "https://github.com/owner/repo". Both forms are accepted (`backend/app/github.py:17`).
- Accepted, not a fault: the 26px message row pushes the story card down (repo height 40 to 66 [V]). The caller already accepts the same shift for Requires.
- Fix:
  - Give the actions a fixed-width slot (the widest pair, Save + Remove, is 139px) so the field never moves.
  - Add "Invalid link" and "GitHub did not answer, Retry" states.
  - Add Cancel to the change state, and define Save as going through Checking, Not found and Linked.
  - Disable Link while the field is empty.
  - Use `role="status"` on the message, and make the copy say "Press Link to check it, or Cancel".

### 11. [MAJOR] Select pills have dead zones, and U3's controls miss D6's own 44px phone rule

- Element: Type and Category pills, Status and License values, Timeline, Requires, ghost pills, pencil, Limitations.
- Evidence [V]:
  - The Type pill is 54x28, but its `<select>` is 30x28. The Category pill is 81 wide, its select 57. `elementFromPoint` 3px inside either edge hits `span.sel-ed`, so a tap on the pill padding does nothing. Status and License have 6px dead edges.
  - Phone targets at 390:
    - Status 54x20, or 34x20 when filled.
    - Timeline 84x20, License 54x20, Requires 143x20.
    - Ghost pills, pencil and Limitations are 28 high.
  - D6 raises its own `.btn2`, `.copy` and `.primary` to 44px on phone; U3's controls were not added to that rule.
- Guideline: `touch-target-size` (44), `web-target-size` (24 minimum; Status at 20px high fails even that unless the spacing exception holds), `no-precision-required`.
- Fix: each case needs a different technique.
  - Selects: the overlay select from finding 3 makes the whole pill the target. On phone, extend it with `inset:-8px 0` (Status and License `inset:-12px 0`) so the `<select>` itself covers 44px. A `::before` on the wrapper would catch the tap itself and recreate the dead zone.
  - Buttons (`.fv-btn`, `.ghost-pill`, `.editchip`, `.addlink`): `position:relative` plus a transparent `::before{inset:-8px 0}` (`-12px` for the 20px Timeline) under `@container pd (max-width:640px)`.
  - Requires: `::before` does not render on an `<input>`. Once finding 1 makes it a textarea, use the `.ed` technique the plan already relies on: vertical padding paid back by negative margin (`--py:12px`). That is zero geometry, rule 2.

### 12. [MAJOR] The dashed cue is under 3:1 where it is the only thing marking a field; two names fail label-in-name

- Element: dashed outline `--dash:#A39EEC` (b:204, b:222, b:245, b:259); ghost buttons "Add up to 7" and "Add up to 5" (b:168-169).
- Evidence [V]:
  - `#A39EEC` measures 2.43:1 on white cards and 2.23:1 on the page background `#F5F5FA`.
  - WCAG 1.4.11 (3:1) applies where the outline is what identifies the control: the three story textareas, the description, Requires and the empty terminal. The "+ Add ..." pills are identified by their text, so they are not a 1.4.11 failure, but they share the same faint cue.
  - The visible text "Add up to 7" is not contained in the accessible name "Add languages, up to 7" (b:168), which fails WCAG 2.5.3 (A): a speech user saying "click Add up to 7" gets no match. The same holds for "Add up to 5".
  - Also, "Add up to 7" states only the maximum, but the backend requires at least one language and one framework or tool (`catalog.py:102`).
- Fix:
  - Set `--dash:#857FE0`: 3.44:1 on white, 3.16:1 on `#F5F5FA` [V].
  - Use aria-labels "Add up to 7 languages" and "Add up to 5 frameworks and tools".

### 13. [MINOR] The story segments become a second, weaker progress meter

- Element: the three `.seg` bars in the story card (b:130, b:238-239).
- What is wrong:
  - On D6 they are decoration: they fill automatically in three shades (D6 `.seg i` animation).
  - U3 fills each one only when that step is written. That makes them a per-step meter that duplicates the header's "Story" segment.
  - Step 1's written colour `#C4BFF5` against the track `#ECEBF3` is 1.46:1 [V], so "written" and "empty" look the same.
  - "How it works" is optional, but its empty bar looks like a missing step.
- Fix: keep D6's behaviour (all three fill on load, `aria-hidden` as now) and remove `.up .sstep.filled` (b:238-239). The dashed textareas already show what is empty.

### 14. [MINOR] Optional fields are marked four ways (Timeline not at all), and "+ Limitations" has no designed result

- Element:
  - Repository: the visible word "optional" (b:101).
  - How it works: "(optional)" inside the placeholder, which disappears on the first keystroke (b:127).
  - Limitations: "optional" only in its aria-label (b:195).
  - Timeline: no mark.
- Evidence [V]:
  - The backend does not require dates (`started_on` is not in `REQUIRED_FIELDS`, `catalog.py:91-104`).
  - The live page drops the Timeline row when there is no date (`frontend/src/components/project/sections.tsx:164`).
  - U3's empty "Add dates" ghost is styled exactly like the required Status and License.
  - "+ Limitations" opens D6's amber Limitations block (`build_d4.py:121`, D6:127), but no state shows where its field appears, how tall it is, or how to remove it.
  - The button stays in the filled state, where D6 shows nothing [V] (`filled-1440.png`).
- Fix:
  - One rule: required fields carry no mark; every optional ghost shows "optional" in `--ph` 13px inside the ghost (as the repo already does), including Timeline and How it works (as a label suffix, not in the placeholder).
  - Draw the Limitations empty and filled states in the place D6 prints `.lim`, under Requires. Show "+ Limitations optional" only while empty.
  - Decide what the Facts strip shows when Timeline is empty.
- Owner decision: should an empty Timeline show on the published page as a blank cell, or should the strip drop to two cells? Recommended: two cells. The live page already drops the row.

### 15. [MINOR] Off-scale colours, radius, gaps, and one off-scale font size against D6

- Evidence [V], diff of `U3_CSS` against D6's stylesheet:
  - Colours: U3 adds 11 colours not in D6: `#A39EEC #6E6C88 #8A88A3 #E3E2EC #B9B7CE #FAFAFD #F7F7FE #FBFBFF #F1F0FD #DC2626 #B91C1C`. Among them:
    - four near-identical hover tints next to D6's `#F5F5FA`;
    - `#F1F0FD`, which nearly duplicates D6's chip `#F1F0FA`;
    - minibar track `#E3E2EC`, which nearly duplicates D6's segment track `#ECEBF3`.
  - Radius: a 6px radius (b:248, b:250) where D6 uses only 16, 8, 999, 2 and 50%.
  - Gaps: 3, 6, 10 and 20px gaps where D6 uses 4, 8, 12, 16 and 24.
  - Header button: "Render project" computes to 15px. D6's `.primary` uses `font-size:var(--cap)` (D6:56), but `--cap` is defined on `.main`, and the header is outside `.main`, so the size falls back to 15px. The repo `.primary` and every other button are 13px.
- Fix: use the token table below, and add `.bar .primary{font-size:13px}`.

## Proposed type scale (D6's, unchanged; U3 should add nothing)

| Role | Base (<1700px) | Wide (>=1700px) | Phone (<=640px) | Weight |
|------|----------------|-----------------|-----------------|--------|
| Project name | 40 / 44 | 56 / 61.6 | 28 | 700 |
| Card and step title, video slot title | 17 / 28 | 21 / 28 | 17 / 28 | 600 |
| Description | 17 / 25.5 | 21 / 31.5 | 17 | 400 |
| Body, story text, fact values | 15 / 20 (values), 22.5 (story) | 17 / 24, 25.5 | same | 600 values, 400 text |
| Label, caption, hint, error | 13 / 20 | 15 / 24 | 13 / 20 | 400 |
| Buttons, all including header | 13 | 13 (fixed, as D6) | 13 | 600 |
| Terminal | 13 / 24 pitch | 15 / 28 pitch | 13 | 400 mono |

Measured on u3-empty at 1440: every text uses 40, 17, 15 or 13px; the only exception is the header button at 15px [V].

## Proposed spacing, radius and colour set

| Kind | Set | Replace |
|------|-----|---------|
| Radius | 16 (cards, video), 8 (buttons, inputs, editable boxes, fact values, terminal), 999 (pills), 50% (round), 2 (bars) | 6px at b:248, b:250 becomes 8 |
| Gap | 4, 8, 12, 16, 24 | 3 becomes 4 (minibar, or remove it with finding 7); 6 becomes 8 or 4 (repo, reqs); 10 becomes 8; 20 becomes 16 (header) |
| Line, border | `#E6E5EF` (D6) | `#E3E2EC`, `#D9D8E6` as an outline |
| Hover tint | `#F5F5FA` (D6 `.btn2:hover`) | `#FAFAFD`, `#F7F7FE`, `#FBFBFF`, `#F1F0FD` |
| Editable cue (dash, hover outline) | `--dash:#857FE0` dashed; `#4F46E5` solid on hover | `#A39EEC`, `#B9B7CE`, `#D9D8E6` |
| Placeholder | `--ph:#6E6C88` (5.04:1); title `#8A88A3` (3.43:1, large text) | none |
| Error | `--err:#B91C1C` for text and outline (6.47:1) | `#DC2626` |
| Focus | 2px `#4F46E5` | the 1px plus 16% halo variant |

## Checked and fine

- [V] Placeholder text contrast passes: `#6E6C88` is 5.04:1 on white and 4.64:1 on the page; the title placeholder `#8A88A3` is 3.43:1 at 40px bold; the terminal placeholder is 6.44:1. Error text `#B91C1C` is 6.47:1.
- [V] Every button gets D6's 2px focus ring (D6:20). Selects get the ring on their pill, and it shows on the filled "Library" tag (`focus-type-filled.png`). The title, description, story and Requires get a ring (style aside, see finding 8).
- [V] Label-in-name passes for "Change" (the name starts with the visible text), the linked repo button (the name contains "reflex-dev/reflex") and Limitations.
- [V] The empty video slot is one `<label>`, so a click anywhere opens the picker, and it has a keyboard ring through `:has()` (b:262).
- [V] The title exception (no dashed outline at rest, b:231) is acceptable. A grey 40px "Project name" reads as a placeholder at 3.43:1, and a box would sit 2px from the description's box. Once the dash meets 3:1 (finding 12) the difference becomes more visible; a dashed underline is the fallback if Bek objects.
- [V] Desktop tab order (column by column: video, repo, story, then ident to run) follows the visual columns at 1440. [D] The same holds at 1920, which has the same DOM and two-column grid.
- [V] At 1920 the wide tier scales every U3 control that should scale (pencil `var(--chip)`, text, terminal pitch). "Change" and the Render button stay fixed, as D6's header and `.copy` do.
- [V] Built with: the empty rows (Languages, Frameworks & tools) turn into D6's catalog groups when filled. That is D6's display rule, not a U3 fault.
- Claim by the caller, not re-measured:
  - filled and empty equal D6 within 1px at 1440x900 and 1920x1080;
  - focus moves nothing;
  - 0 scroll for empty and filled at the four sizes, and the error state scrolls 23px and 5px;
  - no horizontal scroll at 390;
  - no text under 13px;
  - every control has a name.

  Findings 1 and 3 show conditions those measurements did not cover: long values, and browsers without `field-sizing`.
- Measurement note: in this browser, computed outline widths come back as 0.52px for 1px and 1.57px for 2px, an artefact of the harness's device scale. I cite the CSS values, not those numbers.
- Plan drift: plan.md line 47 says the empty video uses D6's `#EEF0F5` frame and shows a dashed outline only while dragging. The CSS (b:259-261) uses white with a dashed outline at rest. The CSS follows rule 3, so the plan text is stale.

## Outside the brief (DEFERRED)

- The backend still requires `post_languages` (`backend/app/catalog.py:102`) [V], and U3 has no field for it, so every Render would fail with a field the page cannot show until the planned removal lands.
