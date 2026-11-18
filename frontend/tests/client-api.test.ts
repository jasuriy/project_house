import { afterEach, describe, expect, it, vi } from "vitest";
import { clientGet, clientPost } from "@/lib/client-api";

function stubFetch(
  impl: (url: string, init?: RequestInit) => Promise<Response>,
) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("clientGet", () => {
  it("returns JSON from a relative URL", async () => {
    const fetchMock = stubFetch(async () => Response.json({ items: [] }));
    expect(await clientGet("/api/v1/projects?limit=24")).toEqual({
      ok: true,
      data: { items: [] },
    });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/projects?limit=24");
  });

  it("maps our error shape, an unknown body and a network error", async () => {
    stubFetch(async () =>
      Response.json(
        { error: { code: "not_authenticated", message: "x" } },
        { status: 401 },
      ),
    );
    expect(await clientGet("/api/v1/auth/me")).toEqual({
      ok: false,
      status: 401,
      code: "not_authenticated",
    });

    stubFetch(async () => new Response("oops", { status: 503 }));
    expect(await clientGet("/x")).toEqual({
      ok: false,
      status: 503,
      code: "http_503",
    });

    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await clientGet("/x")).toEqual({
      ok: false,
      status: 0,
      code: "unreachable",
    });
  });
});

describe("clientPost", () => {
  it("sends a JSON body with its content type", async () => {
    const fetchMock = stubFetch(async () =>
      Response.json({ username: "bek" }, { status: 201 }),
    );
    const result = await clientPost("/api/v1/auth/login", {
      email: "a@b.co",
      password: "x",
    });
    expect(result).toEqual({ ok: true, data: { username: "bek" } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/auth/login");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe(
      "application/json",
    );
    expect(init?.body).toBe(JSON.stringify({ email: "a@b.co", password: "x" }));
  });

  it("sends no body and no content type when there is none", async () => {
    const fetchMock = stubFetch(async () => new Response(null, { status: 204 }));
    await clientPost("/api/v1/auth/logout");
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).has("content-type")).toBe(false);
  });

  it("returns data null on 204", async () => {
    stubFetch(async () => new Response(null, { status: 204 }));
    expect(await clientPost("/api/v1/auth/logout")).toEqual({
      ok: true,
      data: null,
    });
  });

  it("maps a backend error code and a network error", async () => {
    stubFetch(async () =>
      Response.json(
        { error: { code: "invalid_credentials", message: "x" } },
        { status: 401 },
      ),
    );
    expect(await clientPost("/api/v1/auth/login", {})).toEqual({
      ok: false,
      status: 401,
      code: "invalid_credentials",
    });

    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await clientPost("/x")).toEqual({
      ok: false,
      status: 0,
      code: "unreachable",
    });
  });
});

describe("clientPut", () => {
  it("PUTs without a body and maps 204 to null", async () => {
    const { clientPut } = await import("@/lib/client-api");
    const fetchMock = stubFetch(async () => new Response(null, { status: 204 }));
    expect(await clientPut("/api/v1/me/likes/7")).toEqual({ ok: true, data: null });
    expect(fetchMock.mock.calls[0][1]?.method).toBe("PUT");
  });
});
