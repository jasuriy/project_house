"use client";

import { ChevronDown, X } from "lucide-react";
import { box } from "./form";
import { Popover } from "./popover";
import { TagPicker, type TagOption } from "./tag-picker";

/**
 * Several choices in one field box: the chosen ones as chips (each removable), a chevron, and a
 * chooser that opens under the box (a bottom sheet on a phone) to search and add more.
 */
export function ChipsField({
  id,
  label,
  values,
  options,
  onChange,
  placeholder,
  allowCustom,
  maxLength,
  maxItems,
  invalid,
}: {
  id: string;
  label: string;
  values: string[];
  options: TagOption[];
  onChange: (values: string[]) => void;
  placeholder: string;
  allowCustom?: boolean;
  maxLength?: number;
  maxItems?: number;
  invalid?: boolean;
}) {
  const byValue = new Map(options.map((o) => [o.value, o]));
  return (
    <div className="flex flex-col gap-[8px]">
      <Popover
        label={label}
        width={360}
        fill
        trigger={({ open, toggle, panelId }) => (
          <button
            type="button"
            id={id}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={panelId}
            aria-describedby={invalid ? `${id}-error` : undefined}
            onClick={toggle}
            className={`${box} ${invalid ? "border-danger" : open ? "border-primary" : "border-[#d3d1e0]"} relative flex h-[44px] items-center pl-[14px] pr-[40px] text-left`}
          >
            <span className={values.length ? "text-ink" : "text-faint"}>
              {values.length ? (maxItems ? `${values.length} of ${maxItems} chosen` : `${values.length} chosen`) : placeholder}
            </span>
            <ChevronDown size={18} strokeWidth={2} aria-hidden="true" className="absolute right-[14px] top-1/2 -translate-y-1/2 text-ink" />
          </button>
        )}
      >
        <TagPicker
          id={`${id}-search`}
          label={label}
          values={values}
          onChange={onChange}
          options={options}
          allowCustom={allowCustom}
          maxLength={maxLength}
          maxItems={maxItems}
        />
      </Popover>
      {values.length > 0 && (
        <ul aria-label={label} className="flex flex-wrap gap-[8px]">
          {values.map((value) => {
            const option = byValue.get(value);
            return (
              <li key={value} className="inline-flex h-chip items-center gap-[6px] rounded-full bg-chip pl-[10px] pr-[4px] text-cap text-ink">
                {option?.icon}
                {option?.label ?? value}
                <button
                  type="button"
                  aria-label={`Remove ${option?.label ?? value}`}
                  onClick={() => onChange(values.filter((v) => v !== value))}
                  className="tap relative inline-flex h-[20px] w-[20px] items-center justify-center rounded-full text-muted outline-none hover:bg-track hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <X size={12} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
