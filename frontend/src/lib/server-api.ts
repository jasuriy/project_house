import type { Catalog, Project, ProjectCard } from "./api";

// Server components call FastAPI directly (not through the /api rewrite): the request starts on
// the server, so there is no browser and no cross-origin question.
const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

async function get<T>(path: string): Promise<T | null> {
  const response = await fetch(`${API_URL}/api/v1${path}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`API ${path} answered ${response.status}`);
  return (await response.json()) as T;
}

/** A published project by its address, or null when there is none. */
export const fetchPublishedProject = (slug: string) =>
  get<Project>(`/projects/by-slug/${encodeURIComponent(slug)}`);

export async function fetchCatalog(): Promise<Catalog> {
  const catalog = await get<Catalog>("/catalog");
  if (!catalog) throw new Error("Catalog not found");
  return catalog;
}

/** The feed: newest first, optionally one category and a search in name, description and stack. */
export async function fetchFeed(filters: { category?: string; q?: string }): Promise<ProjectCard[]> {
  const query = new URLSearchParams();
  if (filters.category) query.set("category", filters.category);
  if (filters.q) query.set("q", filters.q);
  const feed = await get<{ items: ProjectCard[] }>(`/projects${query.size ? `?${query}` : ""}`);
  return feed?.items ?? [];
}
