// Browser side. Relative /api/... URLs keep every request same-origin, so the browser sends the
// Origin header that the backend's CSRF check requires on POST.
import { failureOf, UNREACHABLE, type ApiResult } from "./api-result";

async function request<T>(path: string, init: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, init);
    if (!response.ok) return await failureOf(response);
    if (response.status === 204) return { ok: true, data: null as T };
    try {
      return { ok: true, data: (await response.json()) as T };
    } catch {
      return { ok: false, status: response.status, code: `http_${response.status}` };
    }
  } catch {
    return UNREACHABLE;
  }
}

/** Never throws. 204 gives `{ ok: true, data: null }`. */
export function clientGet<T>(path: string): Promise<ApiResult<T>> {
  return request<T>(path, { method: "GET" });
}

/** JSON POST. Never throws. 204 gives `{ ok: true, data: null }`. */
export function clientPost<T = null>(
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  if (body === undefined) return request<T>(path, { method: "POST" });
  return request<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
