"use client";

import { Eye, EyeOff } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

/**
 * One labelled input (design-guide "Form field", auth mockup `.field`). The error or help text sits
 * under the input and is linked with aria-describedby; an error sets aria-invalid and the red border.
 * `type="password"` adds the show/hide eye (password managers and paste keep working).
 */
export function TextField({
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  required = false,
  requiredMark = required,
  error,
  help,
  labelAside,
  prefix,
  toggleLabels,
}: {
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  /** The red star; the login form leaves it off (auth mockup). */
  requiredMark?: boolean;
  error?: string;
  help?: string;
  labelAside?: ReactNode;
  prefix?: string;
  toggleLabels?: { show: string; hide: string };
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const note = error ?? help;

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-small font-semibold text-fg">
          {label}
          {requiredMark && (
            <span aria-hidden className="text-danger">
              {" "}
              *
            </span>
          )}
        </label>
        {labelAside}
      </div>
      <div
        className={`flex h-11 items-center rounded-control border bg-card md:h-10.5 ${
          error ? "border-danger" : "border-border"
        } focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--color-accent-soft)]`}
      >
        {prefix && <span className="pl-3 text-ui text-mute">{prefix}</span>}
        <input
          id={id}
          data-field
          name={name}
          type={isPassword && visible ? "text" : type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          className={`h-full w-0 min-w-0 flex-1 rounded-control bg-transparent text-ui text-fg placeholder:text-mute outline-none ${
            prefix ? "pr-3" : "px-3"
          }`}
        />
        {isPassword && toggleLabels && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? toggleLabels.hide : toggleLabels.show}
            aria-pressed={visible}
            className="grid size-11 flex-none place-items-center rounded-control text-mute hover:text-fg md:mr-1 md:size-9"
          >
            {visible ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
          </button>
        )}
      </div>
      {note && (
        <p id={noteId} className={`text-meta ${error ? "text-danger" : "text-mute"}`}>
          {note}
        </p>
      )}
    </div>
  );
}
