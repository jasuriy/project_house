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
};

export type ProjectCard = {
  slug: string;
  path: string;
  title: string;
  one_line_problem: string;
  field: FieldName;
  tech_stack: string[];
  cover: Cover | null;
  author: Author;
  published_at: string;
};

export type ProjectDetail = {
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
};

export type FeedPage = {
  items: ProjectCard[];
  next_cursor: string | null;
};

/** The signed-in user: GET /api/v1/auth/me. */
export type Account = {
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
  created_at: string;
  email: string | null;
  email_verified: boolean;
  providers: string[];
};
