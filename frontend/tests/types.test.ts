import { describe, expect, it } from "vitest";
import { FIELD_NAMES, isFieldName } from "@/lib/types";

describe("FIELD_NAMES", () => {
  it("lists the backend's fields in the mockup's filter order", () => {
    // docs/design/2026-11-17-screens-mockup.html: Hammasi, AI ilovalar, Kompyuter koʻrishi,
    // Apparat, Veb, Mobil, Maʼlumotlar, Dasturchilar uchun.
    expect(FIELD_NAMES).toEqual([
      "ai-apps",
      "cv-ml",
      "hardware",
      "web",
      "mobile",
      "data",
      "devtools",
    ]);
  });
});

describe("isFieldName", () => {
  it.each(FIELD_NAMES)("accepts %s", (name) => {
    expect(isFieldName(name)).toBe(true);
  });

  it.each(["", "all", "AI-APPS", "web ", "constructor", "__proto__"])(
    "rejects %j",
    (value) => {
      expect(isFieldName(value)).toBe(false);
    },
  );
});
