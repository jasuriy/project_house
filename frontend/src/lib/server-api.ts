import { cookies } from "next/headers";
import { cache } from "react";
import type { Catalog, Me, Project, ProjectCard } from "./api";

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

/** Who is looking at the page. "unknown" when the API could not say (never shown as logged out). */
export type Account = { state: "in"; me: Me } | { state: "out" } | { state: "unknown" };

/**
 * The logged-in person, read once per request (React cache: the header and the page share it).
 * Only the login cookie is forwarded, and only on this GET. Callers must sit inside <Suspense>:
 * reading cookies is request data (cacheComponents).
 */
export const getAccount = cache(async (): Promise<Account> => {
  const token = (await cookies()).get("ph_session")?.value;
  // Only a value shaped like our tokens is forwarded: the cookie arrives URL-decoded, so a crafted
  // one could otherwise put "; other=..." into the Cookie header sent to the API.
  if (!token || !/^[A-Za-z0-9_-]{20,128}$/.test(token)) return { state: "out" };
  try {
    const response = await fetch(`${API_URL}/api/v1/auth/me`, {
      cache: "no-store",
      headers: { Cookie: `ph_session=${token}` },
    });
    if (response.status === 200) return { state: "in", me: (await response.json()) as Me };
    if (response.status === 401) return { state: "out" };
    return { state: "unknown" };
  } catch {
    return { state: "unknown" };
  }
});
