"use client";

import type { Catalog, FormField, ProjectForm } from "@/lib/api";

// What every section of the upload page (U5) receives.

export type SectionProps = {
  form: ProjectForm;
  setField: <K extends FormField>(field: K, value: ProjectForm[K]) => void;
  catalog: Catalog;
  /** The message for a field after Render found a problem with it, or null. */
  errorFor: (field: string) => string | null;
};
