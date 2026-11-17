import { describe, expect, it } from "vitest";
import { authErrorField, authErrorKey } from "@/lib/auth-errors";

describe("authErrorField", () => {
  it.each([
    ["email_taken", "email"],
    ["username_taken", "username"],
    ["invalid_username", "username"],
    ["weak_password", "password"],
    ["invalid_credentials", "form"],
    ["something_new", "form"],
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
