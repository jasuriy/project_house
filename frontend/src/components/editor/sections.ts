// Which required fields (names from the catalog's required_fields) belong to which part of the
// page. The rule of what is required lives in the backend; this only groups it for display.

// Each section is one line of the "Ready to render" checklist, so no section can be left out of it.
export const SECTIONS: { id: string; ready: string; fields: string[] }[] = [
  {
    id: "details",
    ready: "Project details complete",
    fields: ["name", "short_description", "project_type", "category", "post_languages", "problem", "outcome"],
  },
  { id: "demo", ready: "Demo video uploaded", fields: ["video"] },
  { id: "technology", ready: "Technology stack added", fields: ["languages", "tools"] },
  {
    id: "setup",
    ready: "Setup & delivery complete",
    fields: ["deliverables", "getting_started", "requirements", "license", "status"],
  },
];

export const isComplete = (fields: string[], missing: Set<string>) => fields.every((f) => !missing.has(f));
