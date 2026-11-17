import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PROFILE_ERROR_CODES, profileErrorField, profileErrorKey } from "@/lib/profile-errors";

describe("profileErrorField", () => {
  it.each([
    ["invalid_display_name", "display_name"],
    ["invalid_headline", "headline"],
    ["invalid_location", "location"],
    ["invalid_university_or_employer", "university_or_employer"],
    ["invalid_company_name", "company_name"],
    ["invalid_about", "about"],
    ["invalid_github_link", "github"],
    ["invalid_linkedin_link", "linkedin"],
    ["invalid_website_link", "website"],
    ["field_not_allowed", "form"],
    ["something_new", "form"],
    ["constructor", "form"],
  ])("%s goes to %s", (code, field) => {
    expect(profileErrorField(code)).toBe(field);
  });
});

describe("profileErrorKey", () => {
  it.each([
    ["invalid_github_link", "invalid_github_link"],
    ["unreachable", "unreachable"],
    ["something_new", "generic"],
  ])("%s has the message key %s", (code, key) => {
    expect(profileErrorKey(code)).toBe(key);
  });
});

describe("profile error messages", () => {
  it.each(["uz", "ru", "en"])("%s has a message for every code and the generic one", (locale) => {
    const url = new URL(`../messages/${locale}/auth.json`, import.meta.url);
    const messages = JSON.parse(readFileSync(fileURLToPath(url), "utf8")).ProfileErrors;
    for (const code of [...PROFILE_ERROR_CODES, "generic"]) {
      expect(typeof messages[code], `${locale}: ProfileErrors.${code}`).toBe("string");
    }
  });
});
