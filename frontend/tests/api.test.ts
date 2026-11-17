import { afterEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "@/lib/api";

function stubFetch(
  impl: (url: string, init?: RequestInit) => Promise<Response>,
) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("apiGet", () => {
  it("returns the parsed JSON of a 200", async () => {
    stubFetch(async () => Response.json({ title: "Superset" }));
    expect(await apiGet("/api/v1/projects/demo/superset")).toEqual({
      ok: true,
      data: { title: "Superset" },
    });
  });

  it("uses API_URL as the base and never caches", async () => {
    vi.stubEnv("API_URL", "http://backend:8000");
    const fetchMock = stubFetch(async () => Response.json({}));
    await apiGet("/api/v1/projects");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://backend:8000/api/v1/projects");
    expect(init?.cache).toBe("no-store");
  });

  it("falls back to localhost:8000 without API_URL", async () => {
    vi.stubEnv("API_URL", undefined as unknown as string);
    const fetchMock = stubFetch(async () => Response.json({}));
    await apiGet("/api/health");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/api/health");
  });

  it("maps our error shape to its code", async () => {
    stubFetch(async () =>
      Response.json(
        { error: { code: "project_not_found", message: "No such project" } },
        { status: 404 },
      ),
    );
    expect(await apiGet("/x")).toEqual({
      ok: false,
      status: 404,
      code: "project_not_found",
    });
  });

  it("maps a non-JSON 500 to http_500", async () => {
    stubFetch(
      async () =>
        new Response("<html>Bad gateway</html>", {
          status: 500,
          headers: { "content-type": "text/html" },
        }),
    );
    expect(await apiGet("/x")).toEqual({
      ok: false,
      status: 500,
      code: "http_500",
    });
  });

  it("maps JSON without our error shape to http_<status>", async () => {
    stubFetch(async () => Response.json({ detail: "boom" }, { status: 502 }));
    expect(await apiGet("/x")).toEqual({
      ok: false,
      status: 502,
      code: "http_502",
    });
  });

  it("maps a 200 with a broken body to http_200 instead of throwing", async () => {
    stubFetch(async () => new Response("not json", { status: 200 }));
    expect(await apiGet("/x")).toEqual({
      ok: false,
      status: 200,
      code: "http_200",
    });
  });

  it("maps a thrown network error to unreachable", async () => {
    stubFetch(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await apiGet("/x")).toEqual({
      ok: false,
      status: 0,
      code: "unreachable",
    });
  });

  it("forwards the cookie header when given", async () => {
    const fetchMock = stubFetch(async () => Response.json({}));
    await apiGet("/api/v1/auth/me", { cookie: "ph_session=abc" });
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("cookie")).toBe("ph_session=abc");
  });

  it("sends no cookie header when none is given", async () => {
    const fetchMock = stubFetch(async () => Response.json({}));
    await apiGet("/x");
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.has("cookie")).toBe(false);
  });

  it("passes an abort signal so a hanging backend cannot hang the page", async () => {
    const fetchMock = stubFetch(async () => Response.json({}));
    await apiGet("/x");
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
