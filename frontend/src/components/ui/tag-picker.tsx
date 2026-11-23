"use client";

import { ChevronDown, Plus, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

export type TagOption = { value: string; label: string; icon?: ReactNode };

type TagPickerProps = {
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: TagOption[];
  /** Allow typing a value that is not in the list (technologies). */
  allowCustom?: boolean;
  maxLength?: number;
  maxItems?: number;
  invalid?: boolean;
  placeholder?: string;
};

/** Several choices shown as removable chips, with a searchable list to add more. */
export function TagPicker({
  id,
  values,
  onChange,
  options,
  allowCustom,
  maxLength,
  maxItems,
  invalid,
  placeholder = "Choose...",
}: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    searchRef.current?.focus();
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const byValue = new Map(options.map((o) => [o.value, o]));
  const chosen = new Set(values.map((v) => v.toLowerCase()));
  const q = query.trim().toLowerCase();
  const matches = options.filter((o) => !chosen.has(o.value.toLowerCase()) && o.label.toLowerCase().includes(q));
  const canAddCustom =
    allowCustom && q !== "" && !chosen.has(q) && !options.some((o) => o.label.toLowerCase() === q);
  const full = maxItems !== undefined && values.length >= maxItems;

  const add = (value: string) => {
    if (full) return;
    onChange([...values, value]);
    setQuery("");
  };
  const remove = (value: string) => onChange(values.filter((v) => v !== value));

  return (
    <div ref={rootRef} className="relative">
      <div
        onClick={() => setOpen(true)}
        className={`flex min-h-[27px] w-full cursor-pointer max-sm:min-h-[44px] flex-wrap items-center gap-x-[6px] gap-y-[4px] rounded-[7px] border bg-field py-[2px] pl-[4px] pr-[18px] ${
          invalid ? "border-danger" : open ? "border-primary ring-2 ring-primary/20" : "border-field-line"
        }`}
      >
        {values.length === 0 && <span className="pl-[6px] text-[12.5px] text-faint">{placeholder}</span>}
        {values.map((value) => {
          const option = byValue.get(value);
          return (
            <span
              key={value}
              className="inline-flex h-[22px] items-center gap-[5px] rounded-[6px] bg-chip pl-[7px] pr-[2px] text-[10.5px] max-sm:h-[30px] max-sm:text-[13px] font-medium text-ink-2"
            >
              {option?.icon}
              {option?.label ?? value}
              <button
                type="button"
                aria-label={`Remove ${option?.label ?? value}`}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(value);
                }}
                className="flex h-[14px] w-[14px] items-center justify-center rounded-[4px] max-sm:h-[26px] max-sm:w-[26px] text-muted hover:bg-black/5 hover:text-ink"
              >
                <X size={11} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </span>
          );
        })}
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Add"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className="absolute right-[4px] top-[5px] flex h-[16px] w-[18px] max-sm:top-[8px] max-sm:h-[28px] max-sm:w-[28px] items-center justify-center text-ink-2"
        >
          <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 rounded-[8px] border border-line bg-white p-[6px] shadow-[0_8px_24px_rgba(20,16,50,0.12)]">
          <input
            ref={searchRef}
            value={query}
            maxLength={maxLength}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter") {
                e.preventDefault();
                if (matches[0]) add(matches[0].value);
                else if (canAddCustom) add(query.trim());
              }
            }}
            role="combobox"
            aria-controls={listId}
            aria-expanded="true"
            aria-label="Search"
            placeholder={full ? `At most ${maxItems}` : allowCustom ? "Search or type a new one" : "Search"}
            disabled={full}
            className="mb-[4px] h-[28px] w-full rounded-[6px] border border-field-line px-[8px] text-[13px] max-sm:h-[44px] max-sm:text-[16px] outline-none focus:border-primary"
          />
          <ul id={listId} role="listbox" className="max-h-[220px] overflow-y-auto">
            {matches.map((o) => (
              <li key={o.value} role="option" aria-selected="false">
                <button
                  type="button"
                  onClick={() => add(o.value)}
                  className="flex w-full items-center gap-[8px] rounded-[5px] px-[8px] py-[5px] text-left text-[13px] hover:bg-primary-tint max-sm:min-h-[44px] max-sm:text-[15px]"
                >
                  {o.icon}
                  {o.label}
                </button>
              </li>
            ))}
            {canAddCustom && (
              <li role="option" aria-selected="false">
                <button
                  type="button"
                  onClick={() => add(query.trim())}
                  className="flex w-full items-center gap-[8px] rounded-[5px] px-[8px] py-[5px] text-left text-[13px] text-primary hover:bg-primary-tint"
                >
                  <Plus size={14} aria-hidden="true" />
                  Add &ldquo;{query.trim()}&rdquo;
                </button>
              </li>
            )}
            {matches.length === 0 && !canAddCustom && (
              <li className="px-[8px] py-[5px] text-[13px] text-faint">Nothing to add</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
