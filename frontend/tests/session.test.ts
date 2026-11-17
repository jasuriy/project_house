import { beforeEach, describe, expect, it, vi } from "vitest";

const incoming = vi.hoisted(() => ({ cookie: null as string | null }));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers(incoming.cookie ? { cookie: incoming.cookie } : {}),
}));
const apiGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ apiGet }));

const { getCurrentUser } = await import("@/lib/session");

const account = { username: "bek", email: "bek@example.com" };

beforeEach(() => {
  apiGet.mockReset();
  incoming.cookie = null;
});

describe("getCurrentUser", () => {
  it("asks /me with the visitor's cookie and returns the account", async () => {
    incoming.cookie = "ph_session=abc";
    apiGet.mockResolvedValue({ ok: true, data: account });
    expect(await getCurrentUser()).toEqual(account);
    expect(apiGet).toHaveBeenCalledWith("/api/v1/auth/me", {
      cookie: "ph_session=abc",
    });
  });

  it("returns null without calling the API when there is no cookie", async () => {
    expect(await getCurrentUser()).toBeNull();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it.each([401, 500, 0])("returns null on status %i", async (status) => {
    incoming.cookie = "ph_session=abc";
    apiGet.mockResolvedValue({ ok: false, status, code: "x" });
    expect(await getCurrentUser()).toBeNull();
  });
});
