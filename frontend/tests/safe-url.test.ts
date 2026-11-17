import { describe, expect, it } from "vitest";
import { safeExternalUrl, safeNextPath } from "@/lib/safe-url";

describe("safeExternalUrl", () => {
  it.each([
    "http://example.com",
    "https://github.com/apache/superset",
    "https://example.com/a?b=1#c",
  ])("keeps %s", (url) => {
    expect(safeExternalUrl(url)).toBe(url);
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://example.com/file",
    "/relative/path",
    "example.com",
    "not a url",
    "",
  ])("rejects %j", (url) => {
    expect(safeExternalUrl(url)).toBeNull();
  });

  it("rejects null and undefined", () => {
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it.each([
    "//evil.com",
    "https://evil.com",
    "http://evil.com/x",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r/evil.com",
    "/.//evil.com",
    "/a/../..//evil.com",
    "/%2e//evil.com",
    "evil.com",
    "settings",
    "",
  ])("sends %j to /", (next) => {
    expect(safeNextPath(next)).toBe("/");
  });

  it.each(["/%09/evil.com", "/%0a/evil.com"])(
    "sends %s to / after the query string has been decoded",
    (encoded) => {
      const next = new URLSearchParams(`next=${encoded}`).get("next");
      expect(next).toMatch(/^\/[\t\n]\/evil\.com$/);
      expect(safeNextPath(next)).toBe("/");
    },
  );

  it("sends null and undefined to /", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });

  it.each([42, {}, ["/settings"], true])(
    "sends the non-string %j to / instead of throwing",
    (value) => {
      expect(safeNextPath(value as unknown as string)).toBe("/");
    },
  );

  it.each(["/settings", "/demo/x?y=1#z", "/", "/a/b?c=d"])(
    "keeps %s",
    (next) => {
      expect(safeNextPath(next)).toBe(next);
    },
  );
});
