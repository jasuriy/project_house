"use client";

import { type ReactNode, useId } from "react";

/** A labelled multi-line field with the same box, focus and error look as TextField. */
export function TextAreaField({
  name,
  label,
  requiredMark = false,
  value,
  onChange,
  maxLength,
  error,
  help,
  labelBadge,
}: {
  name: string;
  label: string;
  requiredMark?: boolean;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  error?: string;
  help?: string;
  labelBadge?: ReactNode;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? help;
  return (
    <div className="grid content-start gap-1.5">
      <div className="flex items-baseline gap-2">
        <label htmlFor={id} className="text-small font-semibold text-fg">
          {label}
          {requiredMark && (
            <span aria-hidden className="text-danger">
              {" "}
              *
            </span>
          )}
        </label>
        {labelBadge}
      </div>
      <div
        className={`rounded-control border bg-card focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--color-accent-soft)] ${
          error ? "border-danger" : "border-border"
        }`}
      >
        <textarea
          id={id}
          data-field
          name={name}
          value={value}
          maxLength={maxLength}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          className="block min-h-24 w-full resize-y rounded-control bg-transparent px-3 py-2.5 text-ui leading-[1.45] text-fg outline-none"
        />
      </div>
      {note && (
        <p id={noteId} className={`text-meta ${error ? "text-danger" : "text-mute"}`}>
          {note}
        </p>
      )}
    </div>
  );
}
