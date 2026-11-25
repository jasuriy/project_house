"use client";

import { CircleDot, Flag, Scale } from "lucide-react";
import { Field, FormSection, InlineCheck, SelectField, TextField } from "@/components/ui/form";
import type { SectionProps } from "./shared";

/** Facts: the values of the project page's facts strip (status, dates, license). */
export function FactsEditor({ form, setField, catalog, errorFor }: SectionProps) {
  const dateError = errorFor("started_on");
  return (
    <FormSection id="facts" icon={Flag} title="Facts">
      <div className="grid grid-cols-2 gap-[16px] max-sm:grid-cols-1">
        <Field id="status" label="Status" missing={!!errorFor("status")}>
          <SelectField
            id="status"
            value={form.status}
            options={catalog.statuses}
            placeholder="Choose"
            icon={CircleDot}
            invalid={!!errorFor("status")}
            onChange={(v) => setField("status", v)}
          />
        </Field>
        <Field id="license" label="License" missing={!!errorFor("license")}>
          <SelectField
            id="license"
            value={form.license}
            options={catalog.licenses}
            placeholder="Choose"
            icon={Scale}
            invalid={!!errorFor("license")}
            onChange={(v) => setField("license", v)}
          />
        </Field>
        <Field id="started_on" label="Started" optional message={dateError}>
          <TextField
            id="started_on"
            type="date"
            value={form.started_on}
            invalid={!!dateError}
            describedBy="started_on-message"
            onChange={(v) => setField("started_on", v || null)}
          />
        </Field>
        <Field
          id="finished_on"
          label="Finished"
          aside={
            <InlineCheck
              id="ongoing"
              checked={form.ongoing}
              onChange={(checked) => {
                if (checked) setField("finished_on", null); // an ongoing project has no end
                setField("ongoing", checked);
              }}
            >
              Still ongoing
            </InlineCheck>
          }
        >
          <TextField
            id="finished_on"
            type="date"
            value={form.ongoing ? null : form.finished_on}
            disabled={form.ongoing}
            invalid={!!dateError}
            describedBy="started_on-message"
            onChange={(v) => setField("finished_on", v || null)}
          />
        </Field>
      </div>
    </FormSection>
  );
}
