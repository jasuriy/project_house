// Server side only. React cache() lets generateMetadata and the page share one request.
import { headers } from "next/headers";
import { cache } from "react";
import { apiGet } from "./api";
import type { CommentPage, FeedPage, ProjectDetail } from "./types";

const MY_LIST_PAGE_SIZE = 24;

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

/** The visitor's own Saved or Liked list (first page); only ever their own (the cookie says who). */
export const getMyList = cache(async (kind: "saved" | "liked") =>
  apiGet<FeedPage>(`/api/v1/me/${kind}?limit=${MY_LIST_PAGE_SIZE}`, {
    cookie: await visitorCookie(),
  }),
);
