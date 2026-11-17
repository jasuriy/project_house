import { headers } from "next/headers";
import { apiGet } from "./api";
import type { Account } from "./types";

/**
 * The signed-in user for this request, or null (no session, expired, backend down).
 * Reads request headers, so call it only inside a Suspense leaf.
 */
export async function getCurrentUser(): Promise<Account | null> {
  const cookie = (await headers()).get("cookie");
  if (!cookie) return null;
  const result = await apiGet<Account>("/api/v1/auth/me", { cookie });
  return result.ok ? result.data : null;
}
