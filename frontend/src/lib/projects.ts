// Server side only. React cache() lets generateMetadata and the page share one request.
import { headers } from "next/headers";
import { cache } from "react";
import { apiGet } from "./api";
import type { CommentPage, ProjectDetail } from "./types";

/** The visitor's cookie: the project page says whether *they* liked or saved it. */
async function visitorCookie(): Promise<string | undefined> {
  return (await headers()).get("cookie") ?? undefined;
}

export const getDemoProject = cache(async (slug: string) =>
  apiGet<ProjectDetail>(`/api/v1/projects/demo/${encodeURIComponent(slug)}`, {
    cookie: await visitorCookie(),
  }),
);

export const getUserProject = cache(async (username: string, slug: string) =>
  apiGet<ProjectDetail>(
    `/api/v1/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(slug)}`,
    { cookie: await visitorCookie() },
  ),
);

/** The first page of comments, with `can_delete` for this visitor. */
export const getComments = cache(async (projectId: number) =>
  apiGet<CommentPage>(`/api/v1/projects/${projectId}/comments`, {
    cookie: await visitorCookie(),
  }),
);
