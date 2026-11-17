/** `url` when it is an absolute http(s) URL, else null. For every link that comes from data. */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

const BASE = "http://x";

/**
 * A same-site path for `?next=` redirects, else "/". Resolves against a fake origin: anything
 * that leaves it (`//evil.com`, `https://evil.com`, `/\evil.com`, `/<tab>/evil.com`, ...) is
 * rejected, and so is anything that does not start with "/" or that resolves to "//...".
 */
export function safeNextPath(next: string | null | undefined): string {
  // Query values reach here from untyped places (URLSearchParams, JSON), so check the type.
  if (typeof next !== "string" || !next.startsWith("/")) return "/";
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return "/";
  }
  if (url.origin !== BASE) return "/";
  // Dot segments are resolved away: "/.//evil.com" becomes "//evil.com", which a browser would
  // read as a protocol-relative URL to another host.
  if (url.pathname.startsWith("//")) return "/";
  return url.pathname + url.search + url.hash;
}
