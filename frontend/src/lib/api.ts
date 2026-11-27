// Types and calls for the backend API. The browser calls /api/* on this site; Next.js forwards
// it to FastAPI (see next.config.ts).

export type Choice = { id: string; label: string };
export type UploadKind = "video" | "poster";

export type Catalog = {
  project_types: Choice[];
  categories: Choice[];
  statuses: Choice[];
  deliverables: Choice[];
  licenses: Choice[];
  text_limits: Record<string, number>;
  max_tech_name: number;
  max_languages: number;
  max_tools: number;
  upload_rules: Record<UploadKind, { content_types: string[]; max_bytes: number }>;
  // What Render needs: form field names, plus "video". The server checks the same list.
  required_fields: string[];
  tech: { name: string; group: string; icon: string | null }[];
  // The server's username rules, so the sign-up page checks with exactly the same ones.
  username_rules: { pattern: string; reserved: string[] };
};

// The fields a person edits in the form (sent with POST /projects on Render).
export type ProjectForm = {
  name: string | null;
  short_description: string | null;
  project_type: string | null;
  category: string | null;
  problem: string | null;
  outcome: string | null;
  languages: string[];
  tools: string[];
  deliverables: string[];
  license: string | null;
  status: string | null;
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
  slug: string;
  published_at: string;
  video: Video | null;
  repo_url: string | null;
  repo: RepoSnapshot | null;
  created_at: string;
  updated_at: string;
};

/** One project in the feed (GET /projects): what its card shows. */
export type ProjectCard = {
  slug: string;
  name: string | null;
  short_description: string | null;
  project_type: string | null;
  category: string | null;
  status: string | null;
  languages: string[];
  tools: string[];
  poster_url: string | null;
  preview_url: string | null; // the short, silent copy the card plays (D34); null until it is made
  published_at: string;
};

/** The logged-in person, as GET /auth/me returns them (their own email included). */
export type Me = {
  id: string;
  username: string;
  display_name: string;
  email: string;
  github_login: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type SignUp = { display_name: string; username: string; email: string; password: string };

export type UploadTicket = { upload_url: string; key: string; headers: Record<string, string> };

/** Everything sent on Render: the form plus the temporary file keys and the repository link. */
export type NewProject = ProjectForm & {
  video: { key: string; file_name: string; duration_seconds: number | null } | null;
  poster_key: string | null;
  repo_url: string | null;
};

export const EMPTY_FORM: ProjectForm = {
  name: null,
  short_description: null,
  project_type: null,
  category: null,
  problem: null,
  outcome: null,
  languages: [],
  tools: [],
  deliverables: [],
  license: null,
  status: null,
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
  // Before Render: nothing is stored on the server.
  uploadUrl: (kind: UploadKind, file: { content_type: string; size: number }) =>
    request<UploadTicket>(`/uploads/${kind}/url`, { method: "POST", body: json(file) }),
  previewRepo: (url: string) => request<RepoSnapshot>("/repos/preview", { method: "POST", body: json({ url }) }),
  // Render: the one request that creates the project.
  createProject: (project: NewProject) => request<Project>("/projects", { method: "POST", body: json(project) }),
  // Accounts: always from the browser, so the login cookie the answer sets reaches the browser.
  signUp: (data: SignUp) => request<Me>("/auth/signup", { method: "POST", body: json(data) }),
  logIn: (email: string, password: string) => request<Me>("/auth/login", { method: "POST", body: json({ email, password }) }),
  logOut: () => request<null>("/auth/logout", { method: "POST" }),
};
