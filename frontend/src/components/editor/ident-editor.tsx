"use client";

import { useRef } from "react";
import { card, DeliverableChip } from "@/components/page/parts";
import { Popover } from "@/components/ui/popover";
import { SelectPill } from "@/components/ui/select-pill";
import { TagPicker } from "@/components/ui/tag-picker";
import { labelOf } from "@/lib/catalog";
import { FieldError, GhostPill, PencilButton, type SectionProps, useAutosize } from "./shared";

/** The name card, edited where the project page shows it: name, type, category, description, You get. */
export function IdentEditor({ form, setField, catalog, errorFor }: SectionProps) {
  const nameRef = useRef<HTMLTextAreaElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  useAutosize(nameRef, form.name);
  useAutosize(descRef, form.short_description);

  const nameError = errorFor("name");
  const tagError = errorFor("project_type") ?? errorFor("category");
  const descError = errorFor("short_description");
  const getError = errorFor("deliverables");
  const deliverables = (
    <TagPicker
      id="deliverables-search"
      label="What people get"
      values={form.deliverables}
      onChange={(v) => setField("deliverables", v)}
      options={catalog.deliverables.map((d) => ({ value: d.id, label: d.label }))}
    />
  );

  return (
    <section aria-label="About the project" className={`${card} flex flex-col gap-gi p-pi max-sm:p-[16px]`}>
      <div className="flex flex-col gap-[4px]">
        <div className="flex flex-wrap items-center justify-between gap-x-[16px] gap-y-[8px]">
          <textarea
            ref={nameRef}
            id="name"
            rows={1}
            value={form.name ?? ""}
            maxLength={catalog.text_limits.name}
            placeholder="Project name"
            aria-label="Project name"
            aria-invalid={!!nameError || undefined}
            aria-describedby={nameError ? "name-error" : undefined}
            // One value: Enter does not start a new line.
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            onChange={(e) => setField("name", e.target.value.replace(/\n/g, " "))}
            className="ed ed-title"
          />
          <div className="flex flex-wrap items-center gap-[8px]">
            <SelectPill
              id="project_type"
              label="Project type"
              look="badge"
              placeholder="Type"
              value={form.project_type}
              options={catalog.project_types}
              invalid={!!errorFor("project_type")}
              errorId="project_type-error"
              onChange={(v) => setField("project_type", v)}
            />
            <SelectPill
              id="category"
              label="Category"
              look="chip"
              placeholder="Category"
              value={form.category}
              options={catalog.categories}
              invalid={!!errorFor("category")}
              errorId="project_type-error"
              onChange={(v) => setField("category", v)}
            />
          </div>
        </div>
        <FieldError id="name" message={nameError} />
        {tagError && (
          <p id="project_type-error" className="text-cap text-danger">
            Choose a type and a category.
          </p>
        )}
        <textarea
          ref={descRef}
          id="short_description"
          value={form.short_description ?? ""}
          maxLength={catalog.text_limits.short_description}
          placeholder="What it is and who it is for"
          aria-label="Short description"
          aria-invalid={!!descError || undefined}
          aria-describedby={descError ? "short_description-error" : undefined}
          onChange={(e) => setField("short_description", e.target.value)}
          className="ed ed-desc"
        />
        <FieldError id="short_description" message={descError} />
      </div>

      <div className="flex flex-col gap-[4px]">
        <div className="flex flex-wrap items-center gap-[8px]">
          <span className="mr-[4px] text-cap text-muted">You get</span>
          {form.deliverables.map((id) => (
            <DeliverableChip key={id} id={id} label={labelOf(catalog.deliverables, id)} />
          ))}
          <Popover
            label="What people get"
            width={320}
            trigger={({ open, toggle, panelId }) =>
              form.deliverables.length > 0 ? (
                <PencilButton id="deliverables" aria-label="Change what people get" aria-expanded={open} aria-controls={panelId} onClick={toggle} />
              ) : (
                <GhostPill
                  id="deliverables"
                  invalid={!!getError}
                  aria-expanded={open}
                  aria-controls={panelId}
                  aria-describedby={getError ? "deliverables-error" : undefined}
                  onClick={toggle}
                >
                  Add what people get
                </GhostPill>
              )
            }
          >
            {deliverables}
          </Popover>
        </div>
        <FieldError id="deliverables" message={getError} />
      </div>
    </section>
  );
}
