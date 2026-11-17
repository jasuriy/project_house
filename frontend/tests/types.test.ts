import { describe, expect, it } from "vitest";
import { FIELD_NAMES, isFieldName } from "@/lib/types";

describe("FIELD_NAMES", () => {
  it("lists the backend's fields in display order", () => {
    expect(FIELD_NAMES).toEqual([
      "ai-apps",
      "cv-ml",
      "web",
      "mobile",
      "devtools",
      "hardware",
      "data",
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
