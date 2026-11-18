// Error codes of PATCH /api/v1/auth/me (backend app/users/profile.py) and where the form shows them.

export type ProfileField =
  | "display_name"
  | "headline"
  | "location"
  | "university_or_employer"
  | "company_name"
  | "about"
  | "github"
  | "linkedin"
  | "website"
  | "photo";

const FIELD_OF: Record<string, ProfileField> = {
  invalid_display_name: "display_name",
  invalid_headline: "headline",
  invalid_location: "location",
  invalid_university_or_employer: "university_or_employer",
  invalid_company_name: "company_name",
  invalid_about: "about",
  invalid_github_link: "github",
  invalid_linkedin_link: "linkedin",
  invalid_website_link: "website",
  invalid_image: "photo",
  image_too_large: "photo",
  image_too_many_pixels: "photo",
};

/** Every code the form has a message for. */
export const PROFILE_ERROR_CODES = [...Object.keys(FIELD_OF), "field_not_allowed", "unreachable"];

const KNOWN = new Set<string>(PROFILE_ERROR_CODES);

/** The input an error belongs to; anything else is a message above the form. */
export function profileErrorField(code: string): ProfileField | "form" {
  return Object.hasOwn(FIELD_OF, code) ? FIELD_OF[code] : "form";
}

/** The message key in `ProfileErrors`; codes we do not know get the generic message. */
export function profileErrorKey(code: string): string {
  return KNOWN.has(code) ? code : "generic";
}
