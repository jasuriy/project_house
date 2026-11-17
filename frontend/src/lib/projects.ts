// Server side only. React cache() lets generateMetadata and the page share one request.
import { cache } from "react";
import { apiGet } from "./api";
import type { ProjectDetail } from "./types";

export const getDemoProject = cache((slug: string) =>
  apiGet<ProjectDetail>(`/api/v1/projects/demo/${encodeURIComponent(slug)}`),
);

export const getUserProject = cache((username: string, slug: string) =>
  apiGet<ProjectDetail>(
    `/api/v1/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(slug)}`,
  ),
);
