import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/format";

// "day month year" in each interface language, from our own month names and in Uzbekistan time
// (UTC+5 all year), so the server and every browser print the same text (no hydration mismatch;
// some browsers have no Uzbek month names and print "2026 M11 17").
describe("formatDate", () => {
  const iso = "2026-11-17T12:00:00Z";

  it.each([
    ["uz", "17 noyabr 2026"],
    ["ru", "17 ноября 2026 г."],
    ["en", "November 17, 2026"],
  ])("formats for %s", (locale, expected) => {
    expect(formatDate(iso, locale)).toBe(expected);
  });

  it.each([
    ["2026-11-17T18:59:59Z", "17 noyabr 2026"], // 23:59:59 in Tashkent
    ["2026-11-17T19:00:00Z", "18 noyabr 2026"], // midnight in Tashkent
    ["2026-12-31T19:30:00Z", "1 yanvar 2027"],
  ])("uses Tashkent time: %s is %s", (value, expected) => {
    expect(formatDate(value, "uz")).toBe(expected);
  });

  it("has a name for every month", () => {
    const months = Array.from({ length: 12 }, (_, m) =>
      formatDate(new Date(Date.UTC(2026, m, 15, 12)).toISOString(), "uz"),
    );
    expect(months.map((text) => text.split(" ")[1])).toEqual([
      "yanvar", "fevral", "mart", "aprel", "may", "iyun",
      "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
    ]);
  });

  it("falls back to English for an unknown locale", () => {
    expect(formatDate(iso, "de")).toBe("November 17, 2026");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatDate("not a date", "en")).toBe("");
  });
});
