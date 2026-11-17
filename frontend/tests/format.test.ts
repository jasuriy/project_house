import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/format";

// "numeric day, long month, numeric year" in each interface language. 12:00 UTC keeps the
// calendar day the same in every timezone the tests may run in.
describe("formatDate", () => {
  const iso = "2026-11-17T12:00:00Z";

  it.each([
    ["en", "November 17, 2026"],
    ["ru", "17 ноября 2026 г."],
  ])("formats for %s", (locale, expected) => {
    expect(formatDate(iso, locale)).toBe(expected);
  });

  it("formats for uz with a month name and the year", () => {
    expect(formatDate(iso, "uz")).toMatch(/17.*2026/);
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatDate("not a date", "en")).toBe("");
  });
});
