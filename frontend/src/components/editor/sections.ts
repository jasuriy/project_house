// The five parts of the upload page counted by the ready bar in the header (D29), and which required
// fields (names from the catalog's required_fields) each one holds. What is required is decided by
// the backend; this only groups it for display.

export const READY_PARTS: { label: string; fields: string[] }[] = [
  { label: "Video", fields: ["video"] },
  { label: "Story", fields: ["problem", "outcome"] },
  { label: "About", fields: ["name", "short_description", "project_type", "category", "deliverables"] },
  { label: "Facts", fields: ["status", "license"] },
  { label: "Built with", fields: ["languages", "tools"] },
];

export const isComplete = (fields: string[], missing: Set<string>) => fields.every((f) => !missing.has(f));

/** True when the parts hold exactly the required fields, so a new required field cannot go uncounted. */
export function partsMatch(required: string[]): boolean {
  const counted = READY_PARTS.flatMap((p) => p.fields).sort();
  return JSON.stringify(counted) === JSON.stringify([...required].sort());
}

/** Where focus goes for each field after a failed Render, in the page's reading order. */
export const FOCUS_ORDER: [field: string, elementId: string][] = [
  ["name", "name"],
  ["project_type", "project_type"],
  ["category", "category"],
  ["short_description", "short_description"],
  ["deliverables", "deliverables"],
  ["status", "status"],
  ["started_on", "started_on-btn"],
  ["license", "license"],
  ["languages", "languages"],
  ["tools", "tools"],
  ["video", "video"],
  ["problem", "problem"],
  ["outcome", "outcome"],
];
