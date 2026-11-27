import type { Catalog, Choice, Project } from "./api";

/** The label of a stored choice id ("web_app" -> "Web app"); the id itself if unknown. */
export function labelOf(choices: Choice[], id: string | null): string {
  if (!id) return "";
  return choices.find((c) => c.id === id)?.label ?? id;
}

export const labelsOf = (choices: Choice[], ids: string[]) => ids.map((id) => labelOf(choices, id));

const GROUP_ORDER = ["Languages", "Frontend", "Backend & AI", "Storage", "Mobile", "DevOps & Tools", "Other"];

export type TechItem = { name: string; icon: string | null };

/**
 * The project's technologies in display rows. Programming languages always go to "Languages"
 * (also when typed by hand); a tool goes to its catalog group, or to "Other" when unknown.
 */
export function techRows(project: Pick<Project, "languages" | "tools">, catalog: Catalog): { group: string; items: TechItem[] }[] {
  const byName = new Map(catalog.tech.map((t) => [t.name, t]));
  const rows = new Map<string, TechItem[]>();
  const add = (group: string, item: TechItem) => rows.set(group, [...(rows.get(group) ?? []), item]);

  for (const name of project.languages) add("Languages", { name, icon: byName.get(name)?.icon ?? null });
  for (const name of project.tools) {
    const known = byName.get(name);
    add(known && known.group !== "Languages" ? known.group : "Other", { name, icon: known?.icon ?? null });
  }
  return GROUP_ORDER.filter((g) => rows.has(g)).map((group) => ({ group, items: rows.get(group)! }));
}

// Every date on the site: English, UTC, short month ("Aug 2026", "Nov 26, 2026").
const MONTH = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "Mar 2026" */
export const monthYear = (iso: string) => MONTH.format(new Date(iso));
/** "Nov 26, 2026" */
export const fullDate = (iso: string) => DAY.format(new Date(iso));

/** "Oct 2022 – now", "Oct 2022 – Mar 2023", "Oct 2022", or null without a start date (D29 format). */
export function timeline(project: Pick<Project, "started_on" | "finished_on" | "ongoing">): string | null {
  if (!project.started_on) return null;
  const start = monthYear(project.started_on);
  const end = project.ongoing ? "now" : project.finished_on ? monthYear(project.finished_on) : null;
  return end ? `${start} – ${end}` : start;
}
