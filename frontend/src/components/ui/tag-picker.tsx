"use client";

import { Plus, X } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

export type TagOption = { value: string; label: string; icon?: ReactNode };

type TagPickerProps = {
  id: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: TagOption[];
  /** Allow typing a value that is not in the list (technologies). */
  allowCustom?: boolean;
  maxLength?: number;
  maxItems?: number;
};

/**
 * Several choices inside a chooser panel: the chosen ones as removable chips, then a search box and
 * the list to add from (typed values too, when allowed). Stops adding at maxItems.
 */
export function TagPicker({ id, label, values, onChange, options, allowCustom, maxLength, maxItems }: TagPickerProps) {
  const [query, setQuery] = useState("");
  const listId = useId();

  const byValue = new Map(options.map((o) => [o.value, o]));
  const chosen = new Set(values.map((v) => v.toLowerCase()));
  const q = query.trim().toLowerCase();
  const matches = options.filter((o) => !chosen.has(o.value.toLowerCase()) && o.label.toLowerCase().includes(q));
  const canAddCustom = allowCustom && q !== "" && !chosen.has(q) && !options.some((o) => o.label.toLowerCase() === q);
  const full = maxItems !== undefined && values.length >= maxItems;

  const add = (value: string) => {
    if (full) return;
    onChange([...values, value]);
    setQuery("");
  };
  const remove = (value: string) => onChange(values.filter((v) => v !== value));

  return (
    <div className="flex flex-col gap-[8px]">
      <p className="flex items-baseline justify-between text-cap">
        <label htmlFor={id} className="font-semibold text-ink">
          {label}
        </label>
        {maxItems !== undefined && (
          <span className="text-muted">
            {values.length} of {maxItems}
          </span>
        )}
      </p>
      {values.length > 0 && (
        <ul aria-label={`Chosen ${label.toLowerCase()}`} className="flex flex-wrap gap-[6px]">
          {values.map((value) => {
            const option = byValue.get(value);
            return (
              <li key={value} className="inline-flex h-[28px] items-center gap-[6px] rounded-full bg-chip pl-[10px] pr-[4px] text-cap text-ink">
                {option?.icon}
                {option?.label ?? value}
                <button
                  type="button"
                  aria-label={`Remove ${option?.label ?? value}`}
                  onClick={() => remove(value)}
                  className="tap relative inline-flex h-[20px] w-[20px] items-center justify-center rounded-full text-muted outline-none hover:bg-track hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <X size={12} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <input
        id={id}
        value={query}
        maxLength={maxLength}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (matches[0]) add(matches[0].value);
          else if (canAddCustom) add(query.trim());
        }}
        role="combobox"
        aria-controls={listId}
        aria-expanded="true"
        placeholder={full ? `At most ${maxItems}` : allowCustom ? "Search or type a new one" : "Search"}
        disabled={full}
        className="h-[36px] w-full rounded-[8px] border border-line bg-card px-[12px] text-cap text-ink outline-none placeholder:text-faint focus:border-primary disabled:bg-page max-sm:h-[44px] max-sm:text-[16px]"
      />
      {!full && (
        <ul id={listId} role="listbox" aria-label={label} className="max-h-[168px] overflow-y-auto">
          {matches.map((o) => (
            <li key={o.value} role="option" aria-selected="false">
              <button
                type="button"
                onClick={() => add(o.value)}
                className="flex w-full items-center gap-[8px] rounded-[8px] px-[8px] py-[6px] text-left text-cap text-ink outline-none hover:bg-page focus-visible:bg-page max-sm:min-h-[44px]"
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
                className="flex w-full items-center gap-[8px] rounded-[8px] px-[8px] py-[6px] text-left text-cap text-primary-strong outline-none hover:bg-page focus-visible:bg-page max-sm:min-h-[44px]"
              >
                <Plus size={14} aria-hidden="true" />
                Add &ldquo;{query.trim()}&rdquo;
              </button>
            </li>
          )}
          {matches.length === 0 && !canAddCustom && <li className="px-[8px] py-[6px] text-cap text-muted">Nothing to add</li>}
        </ul>
      )}
    </div>
  );
}
