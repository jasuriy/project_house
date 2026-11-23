import type { RepoSnapshot } from "./api";

const PREVIEW_ROWS = 4;

/**
 * The few root entries shown in a repository preview (upload page and project page): hidden
 * entries (.github, .devcontainer) are skipped, and the README, when there is one, is the last row
 * because the preview shows its first lines next to the list.
 */
export function previewEntries(repo: RepoSnapshot) {
  const visible = repo.entries.filter((e) => !e.name.startsWith("."));
  const readme = visible.find((e) => e.name.toLowerCase() === "readme.md") ?? null;
  const rows = visible.filter((e) => e !== readme).slice(0, readme ? PREVIEW_ROWS - 1 : PREVIEW_ROWS);
  return { rows: readme ? [...rows, readme] : rows, readme };
}
