// Error codes of /api/v1/me/projects and /api/v1/me/uploads (backend app/projects/editing.py,
// app/media) and where the add/edit form shows them.

export type ProjectField =
  | "title"
  | "one_line_problem"
  | "short_description"
  | "result"
  | "field"
  | "tech_stack"
  | "github_url"
  | "live_url"
  | "role"
  | "video_url"
  | "images";

const FIELD_OF: Record<string, ProjectField> = {
  invalid_title: "title",
  invalid_one_line_problem: "one_line_problem",
  invalid_short_description: "short_description",
  invalid_result: "result",
  invalid_field: "field",
  invalid_tech_stack: "tech_stack",
  invalid_github_url: "github_url",
  invalid_live_url: "live_url",
  invalid_role: "role",
  invalid_video_url: "video_url",
  invalid_images: "images",
  media_required: "images",
  image_too_large: "images",
  invalid_image: "images",
  image_too_many_pixels: "images",
  too_many_uploads: "images",
};

/** Every code the form has a message for. */
export const PROJECT_ERROR_CODES = [
  ...Object.keys(FIELD_OF),
  "developers_only",
  "sample_read_only",
  "slug_taken",
  "unreachable",
];

const KNOWN = new Set<string>(PROJECT_ERROR_CODES);

/** The input an error belongs to; anything else is a message above the form. */
export function projectErrorField(code: string): ProjectField | "form" {
  return Object.hasOwn(FIELD_OF, code) ? FIELD_OF[code] : "form";
}

/** The message key in `EditorErrors`; codes we do not know get the generic message. */
export function projectErrorKey(code: string): string {
  return KNOWN.has(code) ? code : "generic";
}
