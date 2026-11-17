// What the verify-email page does with the answer to POST /api/v1/auth/email/verify.

export type VerifyOutcome = "confirmed" | "login" | "invalid" | "retry";

/**
 * confirmed: 204. login: 401, the token needs the account's own session (it stays stored).
 * invalid: 400, expired or used or another account's link (the stored token is dropped).
 * retry: anything else (network, 5xx, 429, 403): the token stays stored so the user can retry.
 */
export function verifyOutcome(result: { ok: true } | { ok: false; status: number }): VerifyOutcome {
  if (result.ok) return "confirmed";
  if (result.status === 401) return "login";
  if (result.status === 400) return "invalid";
  return "retry";
}
