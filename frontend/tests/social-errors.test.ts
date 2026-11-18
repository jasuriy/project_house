import { describe, expect, it } from "vitest";
import { SOCIAL_ERROR_CODES, socialErrorKey } from "@/lib/social-errors";

describe("socialErrorKey", () => {
  it.each([
    ["invalid_comment", "invalid_comment"],
    ["comment_not_found", "comment_not_found"],
    ["invalid_report", "invalid_report"],
    ["project_not_found", "project_not_found"],
    ["not_authenticated", "not_authenticated"],
    ["unreachable", "unreachable"],
    ["something_new", "generic"],
    ["constructor", "generic"],
  ])("%s has the message key %s", (code, key) => {
    expect(socialErrorKey(code)).toBe(key);
  });

  it("knows every backend code of the social routes", () => {
    // backend/app/social/service.py and the login dependency
    expect([...SOCIAL_ERROR_CODES].sort()).toEqual(
      [
        "comment_not_found",
        "invalid_comment",
        "invalid_report",
        "not_authenticated",
        "project_not_found",
        "unreachable",
      ].sort(),
    );
  });
});
