import { describe, expect, it, vi } from "vitest";

// next-intl/middleware imports "next/server" without extension, which Node ESM
// cannot resolve under vitest. The middleware itself is not under test here,
// only the exported matcher, so stub it.
vi.mock("next-intl/middleware", () => ({ default: () => () => undefined }));

const { config } = await import("@/proxy");
const matcher = new RegExp("^" + config.matcher + "$");

describe("proxy matcher", () => {
  it.each(["/", "/uz", "/uz/x", "/about"])("runs the proxy for %s", (path) => {
    expect(matcher.test(path)).toBe(true);
  });

  it.each(["/favicon.ico", "/api/health", "/_next/static/x.js"])(
    "skips %s",
    (path) => {
      expect(matcher.test(path)).toBe(false);
    },
  );
});
