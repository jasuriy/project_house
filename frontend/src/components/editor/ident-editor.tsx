"use client";

import { CodeXml, FileText, Globe, Layers, Monitor, Smartphone, Sparkle, Tag, type LucideIcon } from "lucide-react";
import { DeliverableIcon } from "@/components/page/parts";
import { ChipsField } from "@/components/ui/chips-field";
import { Field, FormSection, SelectField, TextAreaField, TextField } from "@/components/ui/form";
import type { SectionProps } from "./shared";

const TYPE_ICONS: Record<string, LucideIcon> = {
  web_app: Monitor,
  website: Globe,
  ai_model: Sparkle,
  library: Layers,
  api: CodeXml,
  mobile_app: Smartphone,
};

/** About the project: the fields of the project page's name card. */
export function IdentEditor({ form, setField, catalog, errorFor }: SectionProps) {
  const limit = catalog.text_limits;
  return (
    <FormSection id="about" icon={FileText} title="About the project">
      <Field id="name" label="Project name" missing={!!errorFor("name")} count={{ value: (form.name ?? "").length, max: limit.name }}>
        <TextField
          id="name"
          value={form.name}
          maxLength={limit.name}
          placeholder="e.g. Reflex"
          invalid={!!errorFor("name")}
          onChange={(v) => setField("name", v)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-[16px] max-sm:grid-cols-1">
        <Field id="project_type" label="Type" missing={!!errorFor("project_type")}>
          <SelectField
            id="project_type"
            value={form.project_type}
            options={catalog.project_types}
            placeholder="Choose"
            icon={(form.project_type && TYPE_ICONS[form.project_type]) || Monitor}
            invalid={!!errorFor("project_type")}
            onChange={(v) => setField("project_type", v)}
          />
        </Field>
        <Field id="category" label="Category" missing={!!errorFor("category")}>
          <SelectField
            id="category"
            value={form.category}
            options={catalog.categories}
            placeholder="Choose"
            icon={Tag}
            invalid={!!errorFor("category")}
            onChange={(v) => setField("category", v)}
          />
        </Field>
      </div>
      <Field
        id="short_description"
        label="Short description"
        missing={!!errorFor("short_description")}
        count={{ value: (form.short_description ?? "").length, max: limit.short_description }}
      >
        <TextAreaField
          id="short_description"
          rows={3}
          value={form.short_description}
          maxLength={limit.short_description}
          placeholder="What it is and who it is for"
          invalid={!!errorFor("short_description")}
          onChange={(v) => setField("short_description", v)}
        />
      </Field>
      <Field id="deliverables" label="What people get" missing={!!errorFor("deliverables")}>
        <ChipsField
          id="deliverables"
          label="What people get"
          values={form.deliverables}
          options={catalog.deliverables.map((d) => ({ value: d.id, label: d.label, icon: <DeliverableIcon id={d.id} /> }))}
          placeholder="Choose what people get"
          invalid={!!errorFor("deliverables")}
          onChange={(v) => setField("deliverables", v)}
        />
      </Field>
    </FormSection>
  );
}
