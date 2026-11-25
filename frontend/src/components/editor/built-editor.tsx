"use client";

import { Layers } from "lucide-react";
import { ChipsField } from "@/components/ui/chips-field";
import { Field, FormSection } from "@/components/ui/form";
import { TechIcon } from "@/components/ui/icons";
import type { TagOption } from "@/components/ui/tag-picker";
import type { Catalog } from "@/lib/api";
import type { SectionProps } from "./shared";

/** Built with: programming languages and frameworks & tools (at most 7 and 5, D26). */
export function BuiltEditor({ form, setField, catalog, errorFor }: SectionProps) {
  const toOption = (t: Catalog["tech"][number]): TagOption => ({
    value: t.name,
    label: t.name,
    icon: <TechIcon name={t.name} slug={t.icon} size={14} />,
  });
  // Typed names outside the catalog still get their letter badge.
  const withCustom = (options: TagOption[], values: string[]) => [
    ...options,
    ...values
      .filter((v) => !options.some((o) => o.value === v))
      .map((v) => ({ value: v, label: v, icon: <TechIcon name={v} slug={null} size={14} /> })),
  ];
  const languages = catalog.tech.filter((t) => t.group === "Languages").map(toOption);
  const tools = catalog.tech.filter((t) => t.group !== "Languages").map(toOption);

  return (
    <FormSection id="built" icon={Layers} title="Built with">
      <Field id="languages" label="Programming languages" missing={!!errorFor("languages")}>
        <ChipsField
          id="languages"
          label="Programming languages"
          values={form.languages}
          options={withCustom(languages, form.languages)}
          placeholder={`Add up to ${catalog.max_languages}`}
          allowCustom
          maxLength={catalog.max_tech_name}
          maxItems={catalog.max_languages}
          invalid={!!errorFor("languages")}
          onChange={(v) => setField("languages", v)}
        />
      </Field>
      <Field id="tools" label="Frameworks & tools" missing={!!errorFor("tools")}>
        <ChipsField
          id="tools"
          label="Frameworks & tools"
          values={form.tools}
          options={withCustom(tools, form.tools)}
          placeholder={`Add up to ${catalog.max_tools}`}
          allowCustom
          maxLength={catalog.max_tech_name}
          maxItems={catalog.max_tools}
          invalid={!!errorFor("tools")}
          onChange={(v) => setField("tools", v)}
        />
      </Field>
    </FormSection>
  );
}
