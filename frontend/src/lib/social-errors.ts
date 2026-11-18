// Error codes of the like, save, comment and report routes (backend app/social) and the
// message key in `SocialErrors` that each one shows.

/** Every code the social parts have a message for. */
export const SOCIAL_ERROR_CODES = [
  "invalid_comment",
  "comment_not_found",
  "invalid_report",
  "project_not_found",
  "not_authenticated",
  "unreachable",
];

const KNOWN = new Set<string>(SOCIAL_ERROR_CODES);

/** The message key in `SocialErrors`; codes we do not know get the generic message. */
export function socialErrorKey(code: string): string {
  return KNOWN.has(code) ? code : "generic";
}
