// Mirrors backend/app/projects/schemas.py, backend/app/projects/fields.py and
// backend/app/auth/schemas.py (AccountResponse) field for field.

export type FieldName =
  | "ai-apps"
  | "cv-ml"
  | "web"
  | "mobile"
  | "devtools"
  | "hardware"
  | "data";

// Display order of the field filters, as in the approved mockup's feed.
export const FIELD_NAMES: FieldName[] = [
  "ai-apps",
  "cv-ml",
  "hardware",
  "web",
  "mobile",
  "data",
  "devtools",
];

export function isFieldName(value: string): value is FieldName {
  return (FIELD_NAMES as string[]).includes(value);
}

export type MediaKind = "image" | "video";

export type Cover = {
  kind: MediaKind;
  url: string;
};

export type MediaItem = {
  kind: MediaKind;
  url: string;
  position: number;
  alt: string | null;
};

/** The original author for demo projects, the owner for real ones. */
export type Author = {
  kind: "demo" | "user";
  name: string;
  url: string;
  /** The owner's uploaded photo; null for samples' original authors and people without one. */
  avatar_url?: string | null;
};

export type ProjectCard = {
  id: number;
  slug: string;
  path: string;
  title: string;
  one_line_problem: string;
  field: FieldName;
  tech_stack: string[];
  cover: Cover | null;
  author: Author;
  published_at: string;
  like_count: number;
};

export type ProjectDetail = {
  id: number;
  slug: string;
  path: string;
  is_demo: boolean;
  title: string;
  one_line_problem: string;
  short_description: string;
  result: string | null;
  field: FieldName;
  tech_stack: string[];
  github_url: string | null;
  live_url: string | null;
  demo_video_url: string | null;
  license: string | null;
  role: string | null;
  media: MediaItem[];
  author: Author;
  published_at: string;
  like_count: number;
  comment_count: number;
  /** For the visitor; false for a guest. */
  liked: boolean;
  saved: boolean;
};

/** One comment: GET /api/v1/projects/{id}/comments (backend app/social/schemas.py). */
export type Comment = {
  id: number;
  body: string;
  created_at: string;
  author: { name: string; url: string; avatar_url: string | null };
  /** True for the comment's author and the project's owner. */
  can_delete: boolean;
};

export type CommentPage = {
  items: Comment[];
  next_cursor: string | null;
};

export type ReportReason = "spam" | "not_own_work" | "offensive" | "other";
export const REPORT_REASONS: ReportReason[] = ["spam", "not_own_work", "offensive", "other"];

/** One image of the add/edit form: GET /api/v1/me/projects/{slug} `images`. */
export type EditableImage = { id: number; url: string };

/** What the edit form starts from: GET /api/v1/me/projects/{slug}. */
export type EditableProject = {
  slug: string;
  path: string;
  is_demo: boolean;
  title: string;
  one_line_problem: string;
  short_description: string;
  result: string | null;
  field: FieldName;
  tech_stack: string[];
  github_url: string | null;
  live_url: string | null;
  role: string | null;
  video_url: string | null;
  license: string | null;
  images: EditableImage[];
};

/** POST /api/v1/me/projects/import: the add form's pre-fill from the user's own repository. */
export type ImportPreview = {
  title: string;
  short_description: string;
  tech_stack: string[];
  live_url: string;
  github_url: string;
  license: string | null;
  relation: "owner" | "contributor";
  github_login: string;
};

export type FeedPage = {
  items: ProjectCard[];
  next_cursor: string | null;
};

/** A public profile (backend UserPublic). */
export type UserPublic = {
  username: string;
  display_name: string;
  account_type: "developer" | "company";
  headline: string | null;
  location: string | null;
  university_or_employer: string | null;
  company_name: string | null;
  open_to_work: boolean;
  is_verified_company: boolean;
  avatar_url: string | null;
  links: Record<string, unknown>;
  about: string | null;
  created_at: string;
};

/** The profile page: GET /api/v1/users/{username}. */
export type Profile = UserPublic & { project_count: number; like_total: number };

/** The signed-in user: GET /api/v1/auth/me. */
export type Account = UserPublic & {
  email: string | null;
  email_verified: boolean;
  providers: string[];
};
