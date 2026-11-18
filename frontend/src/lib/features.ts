// Build-time switches. NEXT_PUBLIC_* values are baked into the bundle when the site is built.

/** Email sign-up, login, reset and verification. The deployment builds with
 * NEXT_PUBLIC_EMAIL_LOGIN=false (GitHub sign-in only, no email service yet); unset means on. */
export const EMAIL_LOGIN = process.env.NEXT_PUBLIC_EMAIL_LOGIN !== "false";
