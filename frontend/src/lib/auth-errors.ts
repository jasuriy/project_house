// Maps backend error codes (backend/app/auth, backend/app/users) to where the form shows them and
// which message (messages/<locale>/auth.json, "AuthErrors") it shows.

export type AuthField = "email" | "password" | "username" | "form";

const FIELD_OF: Record<string, AuthField> = {
  email_taken: "email",
  username_taken: "username",
  invalid_username: "username",
  weak_password: "password",
};

/** Which input a backend error belongs to; anything else is a form-level message. */
export function authErrorField(code: string): AuthField {
  return FIELD_OF[code] ?? "form";
}

const KNOWN = new Set([
  "invalid_credentials",
  "email_taken",
  "username_taken",
  "invalid_username",
  "weak_password",
  "token_invalid",
  "not_authenticated",
  "validation_error",
  "unreachable",
  "account_exists",
  "oauth_failed",
  "provider_in_use",
  "provider_already_connected",
  "verify_email_first",
]);

/** The message key for a code; codes we do not know get the generic message. */
export function authErrorKey(code: string): string {
  return KNOWN.has(code) ? code : "generic";
}
