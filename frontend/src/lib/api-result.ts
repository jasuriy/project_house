/** What every API helper returns: it never throws, the caller branches on `ok`. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string };

export const UNREACHABLE: ApiResult<never> = {
  ok: false,
  status: 0,
  code: "unreachable",
};

/**
 * The failure for a non-2xx response: the code from our error shape
 * ({"error": {"code": ...}}), else `http_<status>` (HTML from a proxy, a framework body).
 */
export async function failureOf(response: Response): Promise<ApiResult<never>> {
  let code = `http_${response.status}`;
  try {
    const body: unknown = await response.json();
    const inner = (body as { error?: { code?: unknown } } | null)?.error?.code;
    if (typeof inner === "string" && inner) code = inner;
  } catch {
    // not JSON: keep the http_<status> code
  }
  return { ok: false, status: response.status, code };
}
