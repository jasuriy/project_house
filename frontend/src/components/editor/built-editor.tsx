"use client";

import { useState } from "react";
import { card, stackGrid, stackLabel, TechChip } from "@/components/page/parts";
import { TechIcon } from "@/components/ui/icons";
import { Popover } from "@/components/ui/popover";
import { TagPicker, type TagOption } from "@/components/ui/tag-picker";
import type { Catalog } from "@/lib/api";
import { techRows } from "@/lib/catalog";
import { FieldError, GhostPill, PencilButton, type SectionProps } from "./shared";

/**
 * Built with: the project page's rows (languages, then the tools sorted into their catalog groups).
 * A list still empty keeps its row with an "Add up to N" pill; the pencil changes both lists.
 */
export function BuiltEditor({ form, setField, catalog, errorFor }: SectionProps) {
  // One chooser for both lists, anchored in the card's header: it stays open while the empty rows
  // that can open it disappear (the first language replaces the "Add up to 7" pill).
  const [open, setOpen] = useState(false);
  const rows = techRows(form, catalog);
  const any = form.languages.length + form.tools.length > 0;
  const ghost = (field: "languages" | "tools", label: string, most: number, what: string) => (
    <div className="contents">
      <span className={stackLabel}>{label}</span>
      <div className="flex flex-col items-start gap-[4px]">
        <GhostPill
          id={field}
          invalid={!!errorFor(field)}
          aria-label={`Add up to ${most} ${what}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-describedby={errorFor(field) ? `${field}-error` : undefined}
          onClick={() => setOpen(true)}
        >
          Add up to {most}
        </GhostPill>
        <FieldError id={field} message={errorFor(field)} />
      </div>
    </div>
  );

  return (
    <section aria-labelledby="bw" className={`${card} relative flex flex-col gap-gi p-pc`}>
      <div className="flex items-center justify-between gap-[8px]">
        <h2 id="bw" className="text-h font-semibold">
          Built with
        </h2>
        <Popover
          label="Built with"
          // The card's width, just under its header; the two lists sit side by side.
          panelClassName="inset-x-pc top-[calc(var(--pc)+36px)]"
          open={open}
          onOpenChange={setOpen}
          trigger={({ open: isOpen, toggle, panelId }) =>
            any ? (
              <PencilButton
                aria-label={`Change the stack: ${form.languages.length} of ${catalog.max_languages} languages, ${form.tools.length} of ${catalog.max_tools} frameworks and tools`}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={toggle}
              />
            ) : (
              <span aria-hidden="true" className="block h-[28px]" />
            )
          }
        >
          <StackChooser {...{ form, setField, catalog, errorFor }} />
        </Popover>
      </div>
      <div className={stackGrid}>
        {form.languages.length === 0 && ghost("languages", "Languages", catalog.max_languages, "languages")}
        {rows.map(({ group, items }) => (
          <div key={group} className="contents">
            <span className={stackLabel}>{group}</span>
            <div className="flex flex-wrap gap-[8px]">
              {items.map((item) => (
                <TechChip key={item.name} name={item.name} icon={item.icon} />
              ))}
            </div>
          </div>
        ))}
        {form.tools.length === 0 && ghost("tools", "Frameworks & tools", catalog.max_tools, "frameworks and tools")}
      </div>
    </section>
  );
}

function StackChooser({ form, setField, catalog }: SectionProps) {
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
    <div className="grid grid-cols-2 gap-[16px] max-sm:grid-cols-1">
      <TagPicker
        id="languages-search"
        label="Programming languages"
        values={form.languages}
        onChange={(v) => setField("languages", v)}
        options={withCustom(languages, form.languages)}
        allowCustom
        maxLength={catalog.max_tech_name}
        maxItems={catalog.max_languages}
      />
      <TagPicker
        id="tools-search"
        label="Frameworks & tools"
        values={form.tools}
        onChange={(v) => setField("tools", v)}
        options={withCustom(tools, form.tools)}
        allowCustom
        maxLength={catalog.max_tech_name}
        maxItems={catalog.max_tools}
      />
    </div>
  );
}
