// Mirrors backend app/projects/github.py: what people paste -> owner/repo, compared without case.

const PART = /^[A-Za-z0-9._-]{1,100}$/;

function ownerRepo(link: string | null | undefined): [string, string] | null {
  let value = (link ?? "").trim();
  if (!value) return null;
  if (!value.includes("://")) value = `https://${value}`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.port || url.username || url.password) return null;
  if (!["github.com", "www.github.com"].includes(url.hostname.toLowerCase())) return null;
  const [owner, rawRepo] = url.pathname.split("/").filter(Boolean);
  const repo = rawRepo?.replace(/\.git$/, "");
  if (!owner || !repo) return null;
  if (![owner, repo].every((part) => PART.test(part) && part.replace(/\./g, ""))) return null;
  return [owner.toLowerCase(), repo.toLowerCase()];
}

/** Two links name the same GitHub repository. */
export function sameRepository(a: string | null | undefined, b: string | null | undefined): boolean {
  const first = ownerRepo(a);
  const second = ownerRepo(b);
  return first !== null && second !== null && first[0] === second[0] && first[1] === second[1];
}
