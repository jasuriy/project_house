import { FileText, Layers, Package, Play, type LucideIcon } from "lucide-react";

// Which required fields (names from the API's missing_fields) belong to which part of the page.
// The rule of what is required lives in the backend; this only groups its answer for display.

export type SectionId = "details" | "demo" | "technology" | "setup";

export const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; fields: string[] }[] = [
  {
    id: "details",
    label: "Project details",
    icon: FileText,
    fields: ["name", "short_description", "project_type", "category", "post_languages", "problem", "outcome", "audience"],
  },
  { id: "demo", label: "Demo & links", icon: Play, fields: ["video", "repo"] },
  { id: "technology", label: "Technology", icon: Layers, fields: ["languages", "tools"] },
  {
    id: "setup",
    label: "Setup & delivery",
    icon: Package,
    fields: ["deliverables", "getting_started", "requirements", "license", "status"],
  },
];

/** Before the first save there is no server answer yet: everything required is missing. */
export const ALL_REQUIRED = SECTIONS.flatMap((s) => s.fields);

export const READY_ITEMS: { label: string; fields: string[] }[] = [
  { label: "Project details complete", fields: SECTIONS[0].fields },
  { label: "Demo video uploaded", fields: ["video"] },
  { label: "Repository linked", fields: ["repo"] },
  { label: "Technology stack added", fields: SECTIONS[2].fields },
];

export const isComplete = (fields: string[], missing: Set<string>) => fields.every((f) => !missing.has(f));
