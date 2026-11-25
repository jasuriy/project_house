"use client";

import { factCell, factCellLast, factCellTimeline, factsStrip, factValue } from "@/components/page/parts";
import { Popover } from "@/components/ui/popover";
import { SelectPill } from "@/components/ui/select-pill";
import { timeline } from "@/lib/catalog";
import { FieldError, type SectionProps } from "./shared";

/** The facts strip of the project page with its values picked in place: Status, Timeline, License. */
export function FactsEditor({ form, setField, catalog, errorFor }: SectionProps) {
  const value = factValue;
  const dates = timeline(form);
  const dateError = errorFor("started_on");
  const choiceError = errorFor("status") ?? errorFor("license");

  return (
    <div className="flex flex-col gap-[4px]">
      <div role="group" aria-label="Project facts" className={factsStrip}>
        <div className={factCell}>
          <div className="flex min-w-0 flex-col">
            <label htmlFor="status" className="text-cap text-muted">
              Status
            </label>
            <span className={value}>
              {form.status && <span aria-hidden="true" className="h-[8px] w-[8px] shrink-0 rounded-full bg-primary" />}
              <SelectPill
                id="status"
                label="Status"
                look="fact"
                placeholder="Choose"
                value={form.status}
                options={catalog.statuses}
                invalid={!!errorFor("status")}
              errorId="status-error"
                onChange={(v) => setField("status", v)}
              />
            </span>
          </div>
        </div>
        <div className={factCellTimeline}>
          <div className="flex min-w-0 flex-1 flex-col">
            <span id="timeline-label" className="text-cap text-muted">
              Timeline
            </span>
            <span className={value}>
              <Popover
                label="Timeline"
                width={300}
                trigger={({ open, toggle, panelId }) => (
                  <button
                    type="button"
                    id="started_on-btn"
                    aria-labelledby="timeline-label started_on-btn"
                    aria-expanded={open}
                    aria-controls={panelId}
                    data-invalid={!!dateError || undefined}
                    onClick={toggle}
                    className={`pick tap relative -mx-[8px] inline-flex h-(--lh-cap) items-center rounded-[8px] px-[8px] text-body leading-(--lh-cap) ${
                      dates ? "font-semibold text-ink" : "pick-empty"
                    }`}
                  >
                    {dates ?? "Add dates"}
                  </button>
                )}
              >
                <DatesPanel {...{ form, setField, catalog, errorFor }} />
              </Popover>
            </span>
          </div>
        </div>
        <div className={factCellLast}>
          <div className="flex min-w-0 flex-col">
            <label htmlFor="license" className="text-cap text-muted">
              License
            </label>
            <span className={value}>
              <SelectPill
                id="license"
                label="License"
                look="fact"
                placeholder="Choose"
                value={form.license}
                options={catalog.licenses}
                invalid={!!errorFor("license")}
              errorId="status-error"
                onChange={(v) => setField("license", v)}
              />
            </span>
          </div>
        </div>
      </div>
      {choiceError && (
        <p id="status-error" className="text-cap text-danger">
          Choose a status and a license.
        </p>
      )}
      <FieldError id="started_on" message={dateError} />
    </div>
  );
}

/** Started, finished or still ongoing (optional); the two date rules show while picking. */
function DatesPanel({ form, setField, errorFor }: SectionProps) {
  const error = errorFor("started_on");
  const input =
    "h-[36px] w-full min-w-0 rounded-[8px] border border-line bg-card px-[10px] text-cap text-ink outline-none focus:border-primary disabled:bg-page disabled:text-muted max-sm:h-[44px] max-sm:text-[16px]";
  return (
    <div className="flex flex-col gap-[10px]">
      <div className="grid grid-cols-2 gap-[10px]">
        <label className="flex flex-col gap-[4px] text-cap font-semibold">
          Started
          <input type="date" value={form.started_on ?? ""} onChange={(e) => setField("started_on", e.target.value || null)} className={input} />
        </label>
        <label className="flex flex-col gap-[4px] text-cap font-semibold">
          Finished
          <input
            type="date"
            value={form.ongoing ? "" : (form.finished_on ?? "")}
            disabled={form.ongoing}
            onChange={(e) => setField("finished_on", e.target.value || null)}
            className={input}
          />
        </label>
      </div>
      <label className="flex cursor-pointer items-center gap-[8px] text-cap text-ink max-sm:min-h-[44px]">
        <input
          type="checkbox"
          checked={form.ongoing}
          onChange={(e) => {
            if (e.target.checked) setField("finished_on", null); // an ongoing project has no end
            setField("ongoing", e.target.checked);
          }}
          className="h-[16px] w-[16px] accent-primary"
        />
        Still ongoing
      </label>
      {error && <p className="text-cap text-danger">{error}</p>}
      <p className="text-cap text-muted">Optional. Without dates the page shows a dash.</p>
    </div>
  );
}
