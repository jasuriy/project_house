"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";

const MAX_TAGS = 12;
const MAX_TAG = 30;

/** Tech stack chips (mockup screen 4 `.input` with `.chip`s): type, Enter or comma adds one. */
export function TagsInput({
  label,
  help,
  placeholder,
  removeLabel,
  tags,
  onChange,
  error,
}: {
  label: string;
  help: string;
  placeholder: string;
  removeLabel: (tag: string) => string;
  tags: string[];
  onChange: (tags: string[]) => void;
  error?: string;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const [draft, setDraft] = useState("");

  function add() {
    const tag = draft.trim();
    setDraft("");
    if (!tag || tags.length >= MAX_TAGS) return;
    if (tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return;
    onChange([...tags, tag]);
  }

  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-small font-semibold text-fg">
        {label}
        <span aria-hidden className="text-danger">
          {" "}
          *
        </span>
      </label>
      <div
        className={`flex min-h-11 flex-wrap items-center gap-2 rounded-control border bg-card px-3 py-1.5 focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--color-accent-soft)] md:min-h-10.5 ${
          error ? "border-danger" : "border-border"
        }`}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-[6px] border border-border bg-muted py-0.5 pr-1 pl-2.5 text-meta text-fg"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              aria-label={removeLabel(tag)}
              className="grid size-6 place-items-center rounded-full text-mute hover:text-fg"
            >
              <X aria-hidden size={12} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          id={id}
          data-field
          name="tech_stack"
          value={draft}
          maxLength={MAX_TAG}
          placeholder={tags.length === 0 ? placeholder : ""}
          onChange={(event) => setDraft(event.target.value.replace(",", ""))}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add();
            } else if (event.key === "Backspace" && !draft && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={add}
          aria-invalid={error ? true : undefined}
          aria-describedby={noteId}
          className="h-8 w-0 min-w-24 flex-1 bg-transparent text-ui text-fg placeholder:text-mute outline-none"
        />
      </div>
      <p id={noteId} className={`text-meta ${error ? "text-danger" : "text-mute"}`}>
        {error ?? help}
      </p>
    </div>
  );
}
