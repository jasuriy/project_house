"use client";

import { CodeXml, FileText, Globe, Layers, Monitor, Package, Smartphone, Sparkle, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ChipChoice } from "@/components/ui/chip-choice";
import { Field, SelectInput, TextArea, TextInput } from "@/components/ui/fields";
import { TechIcon } from "@/components/ui/icons";
import { TagPicker, type TagOption } from "@/components/ui/tag-picker";
import type { Catalog, FormField, ProjectForm } from "@/lib/api";

// The three form sections of the middle column. They only show and edit the form; the form
// lives in the useProjectForm hook and is sent once, on Render.

export type SectionProps = {
  form: ProjectForm;
  setField: <K extends FormField>(field: K, value: ProjectForm[K]) => void;
  catalog: Catalog;
  errorFor: (field: string) => string | null;
};

const TYPE_ICONS: Record<string, LucideIcon> = {
  web_app: Monitor,
  website: Globe,
  ai_model: Sparkle,
  library: Layers,
  api: CodeXml,
  mobile_app: Smartphone,
};

export function DetailsSection({ form, setField, catalog, errorFor }: SectionProps) {
  const limit = catalog.text_limits;
  const text = (field: FormField, id: string, area = false) => {
    const Control = area ? TextArea : TextInput;
    return (
      <Control
        id={id}
        value={form[field] as string | null}
        onChange={(v) => setField(field, v as never)}
        maxLength={limit[field]}
        invalid={!!errorFor(field)}
      />
    );
  };

  return (
    <Card id="details" icon={<FileText size={19} strokeWidth={1.7} />} title="Project details">
      <div className="mt-[7px] flex flex-col gap-[9px]">
        <Field id="name" label="Project name" required error={errorFor("name")}>
          {text("name", "name")}
        </Field>
        <Field id="short_description" label="Short description" required error={errorFor("short_description")}>
          {text("short_description", "short_description")}
        </Field>
        <Field id="project_type" label="Project type" required error={errorFor("project_type")}>
          <ChipChoice
            label="Project type"
            value={form.project_type}
            onChange={(v) => setField("project_type", v)}
            options={catalog.project_types.map((t) => ({ ...t, icon: TYPE_ICONS[t.id] ?? Monitor }))}
          />
        </Field>
        <div className="grid grid-cols-1 gap-[9px] sm:grid-cols-2 sm:gap-x-[14px]">
          <Field id="category" label="Category" required error={errorFor("category")}>
            <SelectInput
              id="category"
              value={form.category}
              onChange={(v) => setField("category", v)}
              options={catalog.categories}
              invalid={!!errorFor("category")}
            />
          </Field>
          <Field id="post_languages" label="Post language" required error={errorFor("post_languages")}>
            <TagPicker
              id="post_languages"
              values={form.post_languages}
              onChange={(v) => setField("post_languages", v)}
              options={catalog.post_languages.map((l) => ({ value: l.id, label: l.label }))}
              invalid={!!errorFor("post_languages")}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-[9px] sm:grid-cols-2 sm:gap-x-[14px]">
          <Field id="problem" label="What problem does it solve?" required error={errorFor("problem")}>
            {text("problem", "problem", true)}
          </Field>
          <Field id="outcome" label="What is the outcome?" required error={errorFor("outcome")}>
            {text("outcome", "outcome", true)}
          </Field>
        </div>
      </div>
    </Card>
  );
}

export function TechSection({ form, setField, catalog, errorFor }: SectionProps) {
  const toOption = (t: Catalog["tech"][number]): TagOption => ({
    value: t.name,
    label: t.name,
    icon: <TechIcon name={t.name} slug={t.icon} size={14} />,
  });
  const languages = catalog.tech.filter((t) => t.group === "Languages").map(toOption);
  const tools = catalog.tech.filter((t) => t.group !== "Languages").map(toOption);
  // Typed names outside the catalog still get their letter badge.
  const withCustom = (options: TagOption[], values: string[]) => [
    ...options,
    ...values
      .filter((v) => !options.some((o) => o.value === v))
      .map((v) => ({ value: v, label: v, icon: <TechIcon name={v} slug={null} size={14} /> })),
  ];

  const row = (field: "languages" | "tools", label: string, options: TagOption[]) => (
    <div className="grid grid-cols-1 gap-[5px] sm:grid-cols-[140px_1fr] sm:gap-x-[0px]">
      <label htmlFor={field} className="whitespace-nowrap pt-[6px] text-[11px] font-bold leading-[14px] text-ink-2 max-sm:pt-0 max-sm:text-[13px]">
        {label}
        <span className="ml-[4px] text-danger">*</span>
      </label>
      <div>
        <TagPicker
          id={field}
          values={form[field]}
          onChange={(v) => setField(field, v)}
          options={withCustom(options, form[field])}
          allowCustom
          maxLength={catalog.max_tech_name}
          maxItems={field === "languages" ? catalog.max_languages : catalog.max_tools}
          invalid={!!errorFor(field)}
        />
        {errorFor(field) && <p className="mt-[3px] text-[11px] text-danger">{errorFor(field)}</p>}
      </div>
    </div>
  );

  return (
    <Card id="technology" icon={<Layers size={19} strokeWidth={1.7} />} title="Technology stack">
      <div className="mt-[8px] flex flex-col gap-[12px]">
        {row("languages", "Programming languages", languages)}
        {row("tools", "Frameworks & tools", tools)}
      </div>
    </Card>
  );
}

export function SetupSection({ form, setField, catalog, errorFor }: SectionProps) {
  const limit = catalog.text_limits;
  const input = (field: FormField, placeholder?: string) => (
    <TextInput
      id={field}
      value={form[field] as string | null}
      onChange={(v) => setField(field, v as never)}
      maxLength={limit[field]}
      placeholder={placeholder}
      invalid={!!errorFor(field)}
    />
  );

  return (
    <Card id="setup" icon={<Package size={19} strokeWidth={1.7} />} title="Setup & delivery">
      <div className="mt-[6px] grid grid-cols-1 gap-[8px] sm:grid-cols-2 sm:gap-x-[14px]">
        <Field id="deliverables" label="Deliverable" required error={errorFor("deliverables")}>
          <TagPicker
            id="deliverables"
            values={form.deliverables}
            onChange={(v) => setField("deliverables", v)}
            options={catalog.deliverables.map((d) => ({ value: d.id, label: d.label }))}
            invalid={!!errorFor("deliverables")}
          />
        </Field>
        <Field id="getting_started" label="Getting started" required error={errorFor("getting_started")}>
          {input("getting_started", "e.g. npm install, npm run dev")}
        </Field>
        <Field id="requirements" label="Requirements" required error={errorFor("requirements")}>
          {input("requirements", "e.g. Python 3.11+, Node 20")}
        </Field>
        <Field id="license" label="License" required error={errorFor("license")}>
          <SelectInput
            id="license"
            value={form.license}
            onChange={(v) => setField("license", v)}
            options={catalog.licenses}
            invalid={!!errorFor("license")}
          />
        </Field>
        <Field id="status" label="Status" required error={errorFor("status")}>
          <SelectInput
            id="status"
            value={form.status}
            onChange={(v) => setField("status", v)}
            options={catalog.statuses}
            invalid={!!errorFor("status")}
            tinted
          />
        </Field>
        <Field id="limitations" label="Limitations">
          {input("limitations")}
        </Field>
        <Field id="how_it_works" label="How it works" className="sm:col-span-2">
          <TextArea
            id="how_it_works"
            value={form.how_it_works}
            onChange={(v) => setField("how_it_works", v)}
            maxLength={limit.how_it_works}
            className="h-[52px]"
          />
        </Field>
        <Field id="started_on" label="Started" error={errorFor("started_on")}>
          <DateInput
            id="started_on"
            value={form.started_on}
            onChange={(v) => setField("started_on", v)}
            invalid={!!errorFor("started_on")}
          />
        </Field>
        <Field id="finished_on" label="Finished" error={errorFor("finished_on")}>
          <div className="flex items-center gap-[12px]">
            <DateInput
              id="finished_on"
              value={form.ongoing ? null : form.finished_on}
              onChange={(v) => setField("finished_on", v)}
              disabled={form.ongoing}
              invalid={!!errorFor("finished_on")}
            />
            <label className="flex shrink-0 cursor-pointer items-center gap-[6px] text-[11.5px] text-ink-2">
              <input
                type="checkbox"
                checked={form.ongoing}
                onChange={(e) => {
                  if (e.target.checked) setField("finished_on", null); // an ongoing project has no end
                  setField("ongoing", e.target.checked);
                }}
                className="h-[15px] w-[15px] accent-primary"
              />
              Still ongoing
            </label>
          </div>
        </Field>
      </div>
    </Card>
  );
}

function DateInput({
  id,
  value,
  onChange,
  disabled,
  invalid,
}: {
  id: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <input
      id={id}
      type="date"
      value={value ?? ""}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value || null)}
      className={`h-[25px] w-full min-w-0 rounded-[6px] border max-sm:h-[44px] max-sm:text-[16px] ${invalid ? "border-danger" : "border-field-line"} bg-field px-[10px] text-[12.5px] text-ink-2 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-50`}
    />
  );
}
