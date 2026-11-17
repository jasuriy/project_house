import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBackendStatus } from "@/lib/backend";

const BASE = "http://backend:8000";

function mockFetchResolving(status: number) {
  const fn = vi.fn().mockResolvedValue(new Response(null, { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchBackendStatus", () => {
  it("maps 200 to ok", async () => {
    mockFetchResolving(200);
    await expect(fetchBackendStatus(BASE)).resolves.toBe("ok");
  });

  it("maps 503 to degraded", async () => {
    mockFetchResolving(503);
    await expect(fetchBackendStatus(BASE)).resolves.toBe("degraded");
  });

  it("maps any other status to unreachable", async () => {
    mockFetchResolving(500);
    await expect(fetchBackendStatus(BASE)).resolves.toBe("unreachable");
  });

  it("maps a network error to unreachable without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    await expect(fetchBackendStatus(BASE)).resolves.toBe("unreachable");
  });

  it("requests <baseUrl>/api/health uncached with a 3 s abort signal", async () => {
    const fn = mockFetchResolving(200);
    await fetchBackendStatus(BASE);
    expect(fn).toHaveBeenCalledTimes(1);
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("http://backend:8000/api/health");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("maps a request that never completes to unreachable after 3 s", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "TimeoutError")),
            );
          }),
      ),
    );
    const pending = fetchBackendStatus(BASE);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toBe("unreachable");
  });
});
