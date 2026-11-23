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
export function techRows(project: Project, catalog: Catalog): { group: string; items: TechItem[] }[] {
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

const MONTH = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });

/** "Oct 2022 - ongoing", "Oct 2022 - Mar 2023", or null without a start date. */
export function timeline(project: Project): string | null {
  if (!project.started_on) return null;
  const start = MONTH.format(new Date(project.started_on));
  const end = project.ongoing ? "ongoing" : project.finished_on ? MONTH.format(new Date(project.finished_on)) : null;
  return end ? `${start} - ${end}` : start;
}
