"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

const control =
  "w-full rounded-[6px] border bg-field text-[12.5px] text-ink-2 outline-none transition-colors " +
  "placeholder:text-faint focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 " +
  "max-sm:text-[16px]"; // phones: 16 px stops iOS Safari from zooming into the field

// The tinted look (the mockup's "Status: Prototype") replaces the plain background and text color.
const tintedControl = control.replace("bg-field", "bg-[#ebe9fb]").replace("text-ink-2", "font-medium text-primary-strong");

function borderFor(invalid?: boolean, tinted?: boolean): string {
  return invalid ? "border-danger" : tinted ? "border-[#d9d5f5]" : "border-field-line";
}

/** A label above a control, with the red star for required fields and an error line below. */
export function Field({
  id,
  label,
  required,
  error,
  className = "",
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-[5px] block text-[11px] font-bold leading-[14px] text-ink-2 max-sm:text-[13px] max-sm:leading-[18px]">
        {label}
        {required && <span className="ml-[4px] text-danger">*</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-[3px] text-[11px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

type TextProps = {
  id: string;
  value: string | null;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  invalid?: boolean;
  icon?: ReactNode;
  className?: string;
};

export function TextInput({ id, value, onChange, maxLength, placeholder, invalid, icon, className = "" }: TextProps) {
  return (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-muted">{icon}</span>}
      <input
        id={id}
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className={`${control} ${borderFor(invalid)} h-[25px] max-sm:h-[44px] ${icon ? "pl-[33px]" : "pl-[10px]"} pr-[10px] ${className}`}
      />
    </div>
  );
}

export function TextArea({ id, value, onChange, maxLength, placeholder, invalid, className = "" }: TextProps) {
  return (
    <textarea
      id={id}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : undefined}
      className={`${control} ${borderFor(invalid)} block h-[67px] resize-y px-[10px] py-[5px] leading-[16px] max-sm:h-[96px] max-sm:leading-[22px] ${className}`}
    />
  );
}

/** A native dropdown styled like the mockup (native keeps keyboard and screen readers working). */
export function SelectInput({
  id,
  value,
  onChange,
  options,
  placeholder = "Choose...",
  invalid,
  tinted,
}: {
  id: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: { id: string; label: string }[];
  placeholder?: string;
  invalid?: boolean;
  tinted?: boolean;
}) {
  const filled = value !== null && value !== "";
  return (
    <div className="relative">
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        aria-invalid={invalid || undefined}
        className={`${tinted && filled ? tintedControl : control} ${borderFor(invalid, tinted && filled)} h-[25px] max-sm:h-[44px] appearance-none pl-[10px] pr-[30px] ${
          filled ? "" : "text-faint"
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={15}
        strokeWidth={2}
        aria-hidden="true"
        className="pointer-events-none absolute right-[9px] top-1/2 -translate-y-1/2 text-ink-2"
      />
    </div>
  );
}
