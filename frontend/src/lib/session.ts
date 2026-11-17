import { headers } from "next/headers";
import { cache } from "react";
import { apiGet } from "./api";
import type { Account } from "./types";

/**
 * The signed-in user for this request, or null (no session, expired, backend down).
 * Reads request headers: in the layout it sits inside a Suspense leaf, a page calls it at the top
 * level. Cached per request, so the header and a page share one /me call.
 */
export const getCurrentUser = cache(async (): Promise<Account | null> => {
  const cookie = (await headers()).get("cookie");
  if (!cookie) return null;
  const result = await apiGet<Account>("/api/v1/auth/me", { cookie });
  return result.ok ? result.data : null;
});
