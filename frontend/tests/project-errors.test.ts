import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PROJECT_ERROR_CODES, projectErrorField, projectErrorKey } from "@/lib/project-errors";

describe("projectErrorField", () => {
  it.each([
    ["invalid_title", "title"],
    ["invalid_one_line_problem", "one_line_problem"],
    ["invalid_short_description", "short_description"],
    ["invalid_result", "result"],
    ["invalid_field", "field"],
    ["invalid_tech_stack", "tech_stack"],
    ["invalid_github_url", "github_url"],
    ["invalid_live_url", "live_url"],
    ["invalid_role", "role"],
    ["invalid_video_url", "video_url"],
    ["invalid_images", "images"],
    ["media_required", "images"],
    ["image_too_large", "images"],
    ["developers_only", "form"],
    ["something_new", "form"],
    ["constructor", "form"],
  ])("%s goes to %s", (code, field) => {
    expect(projectErrorField(code)).toBe(field);
  });
});

describe("projectErrorKey", () => {
  it.each([
    ["invalid_video_url", "invalid_video_url"],
    ["unreachable", "unreachable"],
    ["something_new", "generic"],
  ])("%s has the message key %s", (code, key) => {
    expect(projectErrorKey(code)).toBe(key);
  });
});

describe("project error messages", () => {
  it.each(["uz", "ru", "en"])("%s has a message for every code and the generic one", (locale) => {
    const url = new URL(`../messages/${locale}/projects.json`, import.meta.url);
    const messages = JSON.parse(readFileSync(fileURLToPath(url), "utf8")).EditorErrors;
    for (const code of [...PROJECT_ERROR_CODES, "generic"]) {
      expect(typeof messages[code], `${locale}: EditorErrors.${code}`).toBe("string");
    }
  });
});
