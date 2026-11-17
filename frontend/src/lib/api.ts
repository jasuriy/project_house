// Server side only: reads API_URL and runs in server components and generateMetadata.
import { failureOf, UNREACHABLE, type ApiResult } from "./api-result";

export type { ApiResult } from "./api-result";

const TIMEOUT_MS = 10_000;

/**
 * GET <API_URL><path>, never cached (the pages are rendered per request). Never throws:
 * a network error or timeout gives code "unreachable", an error body in our shape gives its
 * code, anything else gives "http_<status>". Pass `cookie` to forward the visitor's session.
 */
export async function apiGet<T>(
  path: string,
  init?: { cookie?: string },
): Promise<ApiResult<T>> {
  const base = process.env.API_URL ?? "http://localhost:8000";
  try {
    const response = await fetch(`${base}${path}`, {
      cache: "no-store",
      headers: init?.cookie ? { cookie: init.cookie } : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return await failureOf(response);
    try {
      return { ok: true, data: (await response.json()) as T };
    } catch {
      return { ok: false, status: response.status, code: `http_${response.status}` };
    }
  } catch {
    return UNREACHABLE;
  }
}
