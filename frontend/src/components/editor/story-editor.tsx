"use client";

import { BookOpen } from "lucide-react";
import { STORY } from "@/components/page/parts";
import { Field, FormSection, TextAreaField } from "@/components/ui/form";
import type { SectionProps } from "./shared";

const PLACEHOLDER = {
  problem: "Who has the problem, and what does it cost them?",
  how_it_works: "The main idea, in a sentence or two",
  outcome: "What changed: a number, a before and after, what people can do now",
} as const;

/** The story: its three parts one under another, tall enough to fill the video column (Bek, 2026-11-25). */
export function StoryEditor({ form, setField, catalog, errorFor }: SectionProps) {
  return (
    <FormSection id="story" icon={BookOpen} title="The story">
      <div className="flex flex-col gap-[16px]">
        {STORY.map((step) => (
          <Field
            key={step.field}
            id={step.field}
            label={step.title}
            optional={step.field === "how_it_works"}
            missing={!!errorFor(step.field)}
            count={{ value: (form[step.field] ?? "").length, max: catalog.text_limits[step.field] }}
          >
            <TextAreaField
              id={step.field}
              rows={7}
              value={form[step.field]}
              maxLength={catalog.text_limits[step.field]}
              placeholder={PLACEHOLDER[step.field]}
              invalid={!!errorFor(step.field)}
              onChange={(v) => setField(step.field, v)}
            />
          </Field>
        ))}
      </div>
    </FormSection>
  );
}
