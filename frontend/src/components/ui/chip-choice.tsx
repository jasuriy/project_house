"use client";

import { Check, type LucideIcon } from "lucide-react";

/** One choice out of a few, shown as buttons (the "Project type" row). */
export function ChipChoice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  options: { id: string; label: string; icon: LucideIcon }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-[8px]">
      {options.map(({ id, label: text, icon: Icon }) => {
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={`inline-flex h-[30px] items-center gap-[9px] rounded-[7px] border px-[10px] text-[11.5px] max-sm:h-[44px] max-sm:px-[14px] max-sm:text-[14px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 ${
              selected
                ? "border-[#d3cffd] bg-primary-soft text-primary"
                : "border-line bg-[#fffefd] text-ink-2 hover:border-field-line"
            }`}
          >
            <Icon size={15} strokeWidth={1.7} aria-hidden="true" />
            {text}
            {selected && <Check size={14} strokeWidth={2.2} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
