# Likes, saves, comments and reports - Design

Date: 2026-11-18. Spec step 4 (`2026-11-17-project-house-design.md` D7, sections 3, 9 items 4 and 6,
10 "Report button"). Approved by Bek in the conversation the same day.

## Intent

People react to projects the way they do on Instagram: like, save for later, comment, and report
something wrong. Companies browsing find what they saved again; developers see that people noticed
their work. Reports are the backstop for projects that are not really someone's own work.

## Bek's decisions (2026-11-18)

- The design below, as proposed.
- **Saved and Liked lists live in your own account:** on your own profile there are two buttons,
  "Saqlanganlar" (Saved) and "Yoqtirganlarim" (Liked); each opens a page with every project you saved
  or liked, newest first. Only you see them.

## Goals

- Like: a heart button with the count on the project page; feed cards and profile cards show the like
  count; the profile shows the total likes the person's projects received (mockup screen 3 stats).
- Save: "Saqlash" on the project page (mockup screen 2), toggles to "Saqlangan".
- Your lists: `/saved` and `/liked`, private, opened from the two buttons on your own profile; same
  card grid as the profile, "load more" like the feed.
- Comments: a flat list under the project (oldest first), a box to write one (1-1000 characters);
  you delete your own; the project's owner deletes any comment on their project.
- Report: "Shikoyat qilish" on projects (mockup screen 2 links row) and on comments; a reason (spam,
  not their own work, offensive, other) and an optional note (0-500); one report per person per item;
  stored for the admin screen of step 6.
- Logged out: counts are visible; pressing like, save, comment or report goes to login and back.

## Non-goals (later)

Notifications; replies to comments; editing comments; who-liked lists; a per-person limit on comments
or reports; the admin screen (step 6); likes on comments.

## Anti-goals

- Saved and Liked lists are never visible to anyone but their owner.
- No public "liked by" list (people would avoid liking a recruiter's view, and vice versa).

## Approaches considered (Claude's call)

| | Approach | Trade-off | Picked |
|---|---|---|---|
| A | Separate tables `project_likes`, `project_saves` (user, project, created_at, both keys primary), `comments`, `reports`; counts computed when a page loads | Simple and clear; one small count query per page of 24 cards | **yes** |
| B | One `reactions` table with a kind column | Fewer tables, more conditions everywhere | no |
| C | A stored like counter on `projects` | Fast reads, but every like writes twice and the counter can drift | no (not needed at this size) |

## Design

### Backend

- Migration 0006: `project_likes(user_id, project_id, created_at)`, `project_saves(...)` (primary
  key `(user_id, project_id)`, both ON DELETE CASCADE, index on `project_id`); `comments(id, project_id,
  author_id, body, created_at)` (both cascade); `reports(id, reporter_id, project_id NULL, comment_id NULL,
  reason, note, created_at, CHECK exactly one target, unique (reporter, project) and (reporter, comment))`.
- Like and save are idempotent: `PUT /api/v1/me/likes/{project_ref}` and `DELETE` (same for saves).
  `project_ref` names a project by its public path parts (owner username + slug, or demo slug).
- Cards (`ProjectCard`) gain `like_count`; the project page response gains `like_count`, and for a
  logged-in viewer `liked` and `saved`.
- `GET /api/v1/me/saved` and `/me/liked`: the viewer's own lists, newest first, feed card shape, cursor.
- Comments: `GET /api/v1/projects/.../comments` (public, oldest first, cursor), `POST` (login), `DELETE
  /api/v1/me/comments/{id}` (author or project owner).
- `POST /api/v1/me/reports` `{project | comment, reason, note}`; a second report on the same item
  answers 200 without a new row.
- The profile response gains `like_total` (likes on the person's projects).
- All writes: login + the existing Origin check. Companies and developers alike.

### Frontend

- Project page: heart + count and "Saqlash" in the action row; "Shikoyat qilish" in the links row;
  the comments section under "Loyiha haqida" (drawn first: screen 2b).
- Cards: the like count in the meta row (mockup screen 1 "214 yoqtirish").
- Own profile: "Saqlanganlar" and "Yoqtirganlarim" buttons next to Edit profile; `/saved` and
  `/liked` pages (same grid as the profile, empty states).
- Report dialog: the native `<dialog>` like the delete confirmation.
- uz / ru / en texts.

## Calls made after the builder check (Claude's, Bek can override)

- **Projects are named by a number.** Responses gain the project's numeric `id`; likes, saves, comments
  and reports use it (`/api/v1/me/likes/{project_id}` ...). One route set for owned and sample projects.
- **Reports outlive what they report.** `reports` keeps `target_kind` ('project' | 'comment'), nullable
  `project_id` / `comment_id` with ON DELETE SET NULL, and a text snapshot (project title or comment
  body, up to 1000 characters) taken when the report is made, so the step-6 admin still sees what was
  reported after the owner deletes it. `reporter_id` is SET NULL when the reporter's account is
  deleted. One report per person per item (partial unique indexes).
- **Saved and Liked lists are ordered by when you saved or liked**, newest first: cursor
  `(created_at, project_id)`, index `(user_id, created_at)` on both tables.
- **No email confirmation needed** to like, save, comment or report: no email service exists yet,
  and requiring it would lock out everyone who signed up with email. Revisit with rate limiting and
  the email service (Step 0b).
- **Owners may like their own project**; it counts like any other like (Instagram does the same).
- **Comments on ownerless samples:** only their authors can delete them (there is no owner).
- **Reserved usernames:** `saved` and `liked` join the reserved list (no account uses them [V]).
- **The project page loads with the visitor's login** so the heart and Saqlash show the right state.
- **Drawings first, no extra approval** (Bek's rule for undrawn screens): screen 2b (heart, Saqlash,
  report link, comment section with delete), the report dialog, the profile buttons, and the
  Saqlanganlar / Yoqtirganlarim pages.

## Left to the builder

Exact component split, cursor shape for comments, the heart icon, texts.
