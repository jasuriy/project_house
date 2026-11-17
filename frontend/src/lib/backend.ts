export type BackendStatus = "ok" | "degraded" | "unreachable";

const TIMEOUT_MS = 3000;

/**
 * Probe GET <baseUrl>/api/health. 200 -> ok, 503 -> degraded; a network
 * error, a timeout or any other status -> unreachable. Never throws.
 */
export async function fetchBackendStatus(
  baseUrl: string,
): Promise<BackendStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status === 200) return "ok";
    if (response.status === 503) return "degraded";
    return "unreachable";
  } catch {
    return "unreachable";
  } finally {
    clearTimeout(timer);
  }
}
