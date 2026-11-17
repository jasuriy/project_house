import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AUTH_ERROR_CODES, authErrorField, authErrorKey } from "@/lib/auth-errors";

describe("authErrorField", () => {
  it.each([
    ["email_taken", "email"],
    ["username_taken", "username"],
    ["invalid_username", "username"],
    ["weak_password", "password"],
    ["invalid_credentials", "form"],
    ["something_new", "form"],
    ["constructor", "form"],
  ])("%s goes to %s", (code, field) => {
    expect(authErrorField(code)).toBe(field);
  });
});

describe("authErrorKey", () => {
  it.each([
    ["invalid_credentials", "invalid_credentials"],
    ["account_exists", "account_exists"],
    ["unreachable", "unreachable"],
    ["something_new", "generic"],
  ])("%s has the message key %s", (code, key) => {
    expect(authErrorKey(code)).toBe(key);
  });
});

describe("auth error messages", () => {
  it.each(["uz", "ru", "en"])("%s has a message for every known code and the generic one", (locale) => {
    const url = new URL(`../messages/${locale}/auth.json`, import.meta.url);
    const messages = JSON.parse(readFileSync(fileURLToPath(url), "utf8")).AuthErrors;
    for (const code of [...AUTH_ERROR_CODES, "generic"]) {
      expect(typeof messages[code], `${locale}: AuthErrors.${code}`).toBe("string");
    }
  });
});
