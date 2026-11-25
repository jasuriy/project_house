"use client";

import type { Choice } from "@/lib/api";

const LOOK = {
  // The project page's type badge, category chip and fact value (components/page/parts.tsx).
  badge: { base: "h-chip rounded-full px-[12px] text-cap", filled: "bg-badge font-semibold text-primary-ink" },
  chip: { base: "h-chip rounded-full px-[12px] text-cap", filled: "bg-chip text-ink" },
  fact: { base: "-mx-[8px] h-(--lh-cap) rounded-[8px] px-[8px] text-body leading-(--lh-cap)", filled: "font-semibold text-ink" },
};

/**
 * A native select drawn as the page's own element. The visible pill is a span sized by the chosen
 * label (not by the longest option); the select lies on top of it, invisible, so the whole pill
 * opens the list and keyboards and screen readers get the native control.
 */
export function SelectPill({
  id,
  label,
  value,
  options,
  placeholder,
  look,
  invalid,
  errorId,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  options: Choice[];
  placeholder: string;
  look: keyof typeof LOOK;
  invalid?: boolean;
  /** The message that explains the error (two pills can share one line). */
  errorId?: string;
  onChange: (value: string | null) => void;
}) {
  const chosen = options.find((o) => o.id === value);
  const { base, filled } = LOOK[look];
  return (
    <span
      data-invalid={invalid || undefined}
      className={`pick relative inline-flex items-center whitespace-nowrap ${base} ${chosen ? filled : "pick-empty"}`}
    >
      <span aria-hidden="true">{chosen?.label ?? placeholder}</span>
      <select
        id={id}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? (errorId ?? `${id}-error`) : undefined}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 max-sm:inset-[min(0px,calc((100%_-_44px)/2))] max-sm:h-auto max-sm:w-auto max-sm:text-[16px]"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}
