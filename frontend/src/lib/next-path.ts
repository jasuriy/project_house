// Where to go after logging in or signing up (?next=). Only a page of this site is allowed:
// otherwise a link could send people to another site right after they log in.
//
// The value is parsed as a URL against a made-up origin instead of checked character by character:
// browsers drop tabs and newlines inside URLs, so "/<tab>/evil.com" would pass a "starts with one
// slash" check and still become "//evil.com", another site.
const BASE = "http://x";

export function safeNext(raw: string | null | undefined): string {
  if (!raw) return "/";
  try {
    const url = new URL(raw, BASE);
    if (url.origin !== BASE) return "/";
    const path = `${url.pathname}${url.search}${url.hash}`;
    // Parsing also removes "." and ".." segments, so "/x/..//evil.com" becomes "//evil.com": a
    // path that is itself another site. Such a result is refused too.
    return path.startsWith("//") ? "/" : path;
  } catch {
    return "/";
  }
}

/** A link to the login or sign-up page that keeps where to go afterwards. */
export function withNext(path: "/login" | "/signup", next: string): string {
  return next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`;
}
