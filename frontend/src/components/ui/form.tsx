"use client";

import { ChevronDown, TriangleAlert } from "lucide-react";
import type { ComponentType, InputHTMLAttributes, ReactNode } from "react";
import type { Choice } from "@/lib/api";

// The upload page's form kit (U5): a visible label above every field, boxes of a fixed size, an
// optional icon inside on the left, a chevron on selects, a character count under text fields, and
// "Missing" beside the label when Render finds the field empty. The sign-up and login forms use it
// too, with a grey hint under the box that the message replaces when there is one.

/** An icon component: a lucide icon or any component taking a size (the GitHub mark). */
export type Icon = ComponentType<{ size?: number; strokeWidth?: number }>;

export const box =
  "w-full rounded-[10px] border bg-card text-body text-ink outline-none transition-colors placeholder:text-faint " +
  "hover:border-[#a9a7c0] focus:border-primary focus:shadow-[0_0_0_3px_rgba(79,70,229,0.16)] disabled:bg-page disabled:text-muted";
const line = (invalid?: boolean) => (invalid ? "border-danger" : "border-[#d3d1e0]");

/**
 * Label row, then the control, then a message under it when there is one. The right end of the label
 * row holds, in this order of priority: "Missing", the given aside, or the character count.
 */
export function Field({
  id,
  label,
  optional,
  missing,
  aside,
  count,
  message,
  hint,
  announce = true,
  className = "",
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  missing?: boolean;
  aside?: ReactNode;
  count?: { value: number; max: number };
  message?: string | null;
  /** Grey text under the box (`${id}-hint`), shown while there is no message. */
  hint?: ReactNode;
  /** Read the message out as it appears. Off where focus moves to the field instead (sign-up). */
  announce?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-[6px] ${className}`}>
      <div className="flex min-h-[20px] items-center justify-between gap-[8px]">
        <label htmlFor={id} className="text-cap font-medium text-ink">
          {label}
          {optional && <span className="font-normal text-muted"> (optional)</span>}
        </label>
        {missing ? (
          <span id={`${id}-error`} className="inline-flex shrink-0 items-center gap-[4px] text-cap text-danger">
            <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" />
            Missing
          </span>
        ) : (
          (aside ??
          (count && (
            <span aria-hidden="true" className="shrink-0 text-cap tabular-nums text-muted">
              {count.value} / {count.max}
            </span>
          )))
        )}
      </div>
      {children}
      {message ? (
        <p id={`${id}-message`} role={announce ? "status" : undefined} className="text-cap text-danger">
          {message}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-cap text-muted [overflow-wrap:anywhere]">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Props every control shares; `invalid` paints the border red and points at the label's "Missing". */
type Base = { id: string; invalid?: boolean; describedBy?: string };
/** Browser hints for a text box (password managers, phone keyboards); left out by default. */
type BrowserHints = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "name" | "autoComplete" | "autoCapitalize" | "spellCheck"
>;
/** What explains an invalid field: the label's "Missing" by default, or the given message instead. */
const described = (id: string, invalid?: boolean, message?: string) => (invalid ? (message ?? `${id}-error`) : undefined);

export function TextField({
  id,
  value,
  onChange,
  maxLength,
  placeholder,
  icon: Icon,
  invalid,
  describedBy,
  type = "text",
  disabled,
  hintId,
  end,
  ...hints
}: Base &
  BrowserHints & {
    value: string | null;
    onChange: (value: string) => void;
    maxLength?: number;
    placeholder?: string;
    icon?: Icon;
    type?: string;
    disabled?: boolean;
    /** What explains the box while it is valid (the Field's hint). */
    hintId?: string;
    /** A control at the right end, inside the box (the password's Show/Hide). */
    end?: ReactNode;
  }) {
  return (
    <span className="relative block">
      {Icon && (
        <span aria-hidden="true" className="pointer-events-none absolute left-[14px] top-1/2 inline-flex -translate-y-1/2 text-muted">
          <Icon size={18} strokeWidth={1.8} />
        </span>
      )}
      <input
        id={id}
        type={type}
        value={value ?? ""}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        {...hints}
        aria-invalid={invalid || undefined}
        aria-describedby={described(id, invalid, describedBy) ?? hintId}
        onChange={(e) => onChange(e.target.value)}
        className={`${box} ${line(invalid)} h-[44px] ${Icon ? "pl-[44px]" : "pl-[14px]"} ${end ? "pr-[84px]" : "pr-[14px]"}`}
      />
      {end && <span className="absolute right-[4px] top-1/2 -translate-y-1/2">{end}</span>}
    </span>
  );
}

/** A text area of a fixed height (it scrolls inside; a corner handle can make it taller). */
export function TextAreaField({
  id,
  value,
  onChange,
  maxLength,
  placeholder,
  rows = 3,
  invalid,
  describedBy,
}: Base & { value: string | null; onChange: (value: string) => void; maxLength?: number; placeholder?: string; rows?: number }) {
  return (
    <textarea
      id={id}
      rows={rows}
      value={value ?? ""}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      aria-describedby={described(id, invalid, describedBy)}
      onChange={(e) => onChange(e.target.value)}
      className={`${box} ${line(invalid)} block resize-y px-[14px] py-[10px] leading-[1.5]`}
    />
  );
}

/** A native select (keyboard and screen readers get the real control), with an icon and a chevron. */
export function SelectField({
  id,
  value,
  options,
  placeholder,
  icon: Icon,
  invalid,
  onChange,
}: Base & { value: string | null; options: Choice[]; placeholder: string; icon?: Icon; onChange: (value: string | null) => void }) {
  return (
    <span className="relative block">
      {Icon && (
        <span aria-hidden="true" className="pointer-events-none absolute left-[14px] top-1/2 inline-flex -translate-y-1/2 text-muted">
          <Icon size={18} strokeWidth={1.8} />
        </span>
      )}
      <select
        id={id}
        value={value ?? ""}
        aria-invalid={invalid || undefined}
        aria-describedby={described(id, invalid)}
        onChange={(e) => onChange(e.target.value || null)}
        className={`${box} ${line(invalid)} h-[44px] cursor-pointer appearance-none ${Icon ? "pl-[44px]" : "pl-[14px]"} pr-[40px] ${value ? "" : "text-faint"}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={18}
        strokeWidth={2}
        aria-hidden="true"
        className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-ink"
      />
    </span>
  );
}

/** A small checkbox for a field's label row ("Still ongoing" beside "Finished"). */
export function InlineCheck({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return (
    <label htmlFor={id} className="tap relative inline-flex shrink-0 cursor-pointer items-center gap-[6px] text-cap text-ink">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-[16px] w-[16px] accent-primary" />
      {children}
    </label>
  );
}

/** A form section: an icon in a soft circle, a title, an optional note on the right, then its fields. */
export function FormSection({
  id,
  icon: Icon,
  title,
  aside,
  children,
}: {
  id: string;
  icon: Icon;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-[16px] rounded-[16px] border border-line bg-card p-[20px] max-sm:p-[16px]">
      <header className="flex items-center justify-between gap-[12px]">
        <h2 id={id} className="flex items-center gap-[10px] text-h font-semibold">
          <span aria-hidden="true" className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-full bg-badge text-primary">
            <Icon size={18} strokeWidth={2} />
          </span>
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}
