"use client";

import { useRef } from "react";
import { card, SegBar, STORY, StepHeading } from "@/components/page/parts";
import { FieldError, type SectionProps, useAutosize } from "./shared";

const PLACEHOLDER = {
  problem: "Who has the problem, and what does it cost them?",
  how_it_works: "The main idea, in a sentence or two (optional)",
  outcome: "What changed: a number, a before and after, what people can do now",
} as const;

/** The story card of the project page, each part written where it shows. */
export function StoryEditor(props: SectionProps) {
  return (
    <section
      aria-label="The story"
      className={`${card} grid auto-cols-[minmax(0,1fr)] grid-flow-col gap-x-pi gap-y-gi px-pi py-pc max-sm:grid-flow-row max-sm:gap-[20px] max-sm:p-[16px]`}
    >
      {STORY.map((step) => (
        <StoryStep key={step.field} step={step} {...props} />
      ))}
    </section>
  );
}

function StoryStep({ step, form, setField, catalog, errorFor }: SectionProps & { step: (typeof STORY)[number] }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const value = form[step.field];
  useAutosize(ref, value);
  const error = errorFor(step.field);
  return (
    <div className="flex min-w-0 flex-col gap-[8px]">
      <SegBar fill={step.fill} delay={step.delay} />
      <StepHeading icon={step.icon} htmlFor={step.field}>
        {step.title}
      </StepHeading>
      <textarea
        ref={ref}
        id={step.field}
        value={value ?? ""}
        maxLength={catalog.text_limits[step.field]}
        placeholder={PLACEHOLDER[step.field]}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${step.field}-error` : undefined}
        onChange={(e) => setField(step.field, e.target.value)}
        className="ed ed-story"
      />
      <FieldError id={step.field} message={error} />
    </div>
  );
}
