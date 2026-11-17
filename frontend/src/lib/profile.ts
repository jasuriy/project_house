// Server side only (apiGet). React cache() lets generateMetadata and the page share one request.
import { cache } from "react";
import { apiGet } from "./api";
import { safeExternalUrl } from "./safe-url";
import type { FeedPage, Profile } from "./types";

export const PROFILE_PAGE_SIZE = 24;

/** The backend's username rule. Anything else (`robots.txt`, probes) is a 404 without an API call. */
export function isUsername(name: string): boolean {
  return /^[a-z0-9_-]{3,30}$/.test(name);
}

export const getProfile = cache((username: string) =>
  apiGet<Profile>(`/api/v1/users/${encodeURIComponent(username)}`),
);

export const getUserProjects = cache((username: string) =>
  apiGet<FeedPage>(
    `/api/v1/users/${encodeURIComponent(username)}/projects?limit=${PROFILE_PAGE_SIZE}`,
  ),
);

export type ProfileLink = { key: "github" | "linkedin" | "website"; label: string; href: string };

/** The profile links worth showing, in a fixed order, each with a short label. Unsafe or unknown
 * entries are dropped (the data comes from users). */
export function profileLinks(links: Record<string, unknown>): ProfileLink[] {
  const result: ProfileLink[] = [];
  for (const key of ["github", "linkedin", "website"] as const) {
    const value = links[key];
    const href = typeof value === "string" ? safeExternalUrl(value) : null;
    if (!href) continue;
    const url = new URL(href);
    const label =
      key === "github"
        ? url.pathname.split("/").filter(Boolean)[0] ?? url.host
        : key === "linkedin"
          ? "LinkedIn"
          : url.host.replace(/^www\./, "");
    result.push({ key, label, href });
  }
  return result;
}
