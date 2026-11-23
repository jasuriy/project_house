// Types and calls for the backend API. The browser calls /api/* on this site; Next.js forwards
// it to FastAPI (see next.config.ts).

export type Choice = { id: string; label: string };
export type UploadKind = "video" | "poster";

export type Catalog = {
  project_types: Choice[];
  categories: Choice[];
  post_languages: Choice[];
  statuses: Choice[];
  deliverables: Choice[];
  licenses: Choice[];
  text_limits: Record<string, number>;
  max_tech_name: number;
  max_tech_per_field: number;
  upload_rules: Record<UploadKind, { content_types: string[]; max_bytes: number }>;
  tech: { name: string; group: string; icon: string | null }[];
};

// The fields a person edits in the form (sent with PATCH /projects/{id}).
export type ProjectForm = {
  name: string | null;
  short_description: string | null;
  project_type: string | null;
  ai_powered: boolean;
  category: string | null;
  post_languages: string[];
  problem: string | null;
  outcome: string | null;
  audience: string | null;
  languages: string[];
  tools: string[];
  deliverables: string[];
  getting_started: string | null;
  requirements: string | null;
  license: string | null;
  status: string | null;
  limitations: string | null;
  how_it_works: string | null;
  started_on: string | null;
  finished_on: string | null;
  ongoing: boolean;
};
export type FormField = keyof ProjectForm;

export type RepoSnapshot = {
  full_name: string;
  html_url: string;
  description: string | null;
  default_branch: string;
  entries: { name: string; type: "dir" | "file" }[];
  readme_lines: string[];
  fetched_at: string;
};

export type Video = {
  url: string;
  poster_url: string | null;
  file_name: string | null;
  content_type: string | null;
  size: number | null;
  duration_seconds: number | null;
};

export type Project = ProjectForm & {
  id: string;
  slug: string | null;
  published_at: string | null;
  video: Video | null;
  repo_url: string | null;
  repo: RepoSnapshot | null;
  missing_fields: string[];
  created_at: string;
  updated_at: string;
};

export type UploadTicket = { upload_url: string; key: string; headers: Record<string, string> };

export const FORM_FIELDS: FormField[] = [
  "name",
  "short_description",
  "project_type",
  "ai_powered",
  "category",
  "post_languages",
  "problem",
  "outcome",
  "audience",
  "languages",
  "tools",
  "deliverables",
  "getting_started",
  "requirements",
  "license",
  "status",
  "limitations",
  "how_it_works",
  "started_on",
  "finished_on",
  "ongoing",
];

export const EMPTY_FORM: ProjectForm = {
  name: null,
  short_description: null,
  project_type: null,
  ai_powered: false,
  category: null,
  post_languages: [],
  problem: null,
  outcome: null,
  audience: null,
  languages: [],
  tools: [],
  deliverables: [],
  getting_started: null,
  requirements: null,
  license: null,
  status: null,
  limitations: null,
  how_it_works: null,
  started_on: null,
  finished_on: null,
  ongoing: false,
};

/** An error answered by the API: {"error": {"code", "message"}}. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error ?? {};
    throw new ApiError(response.status, error.code ?? "network_error", error.message ?? "Request failed");
  }
  return body as T;
}

const json = (data: unknown) => JSON.stringify(data);

export const api = {
  catalog: () => request<Catalog>("/catalog"),
  createProject: () => request<Project>("/projects", { method: "POST" }),
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  updateProject: (id: string, changes: Partial<ProjectForm>) =>
    request<Project>(`/projects/${id}`, { method: "PATCH", body: json(changes) }),
  uploadUrl: (id: string, kind: UploadKind, file: { content_type: string; size: number }) =>
    request<UploadTicket>(`/projects/${id}/uploads/${kind}/url`, { method: "POST", body: json(file) }),
  completeUpload: (
    id: string,
    kind: UploadKind,
    done: { key: string; file_name?: string; duration_seconds?: number | null },
  ) => request<Project>(`/projects/${id}/uploads/${kind}/complete`, { method: "POST", body: json(done) }),
  linkRepo: (id: string, url: string) =>
    request<Project>(`/projects/${id}/repo`, { method: "POST", body: json({ url }) }),
  publish: (id: string) => request<Project>(`/projects/${id}/publish`, { method: "POST" }),
};

/** The same PATCH, sent while the page is closing (the browser finishes it after unload). */
export function saveOnLeave(id: string, changes: Partial<ProjectForm>): void {
  fetch(`/api/v1/projects/${id}`, {
    method: "PATCH",
    body: json(changes),
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  });
}
