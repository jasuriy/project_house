"use client";

import { Pencil, Plus } from "lucide-react";
import { type ComponentProps, forwardRef, type RefObject, useLayoutEffect } from "react";
import type { Catalog, FormField, ProjectForm } from "@/lib/api";

// Small pieces every part of the upload page (U4) uses.

export type SectionProps = {
  form: ProjectForm;
  setField: <K extends FormField>(field: K, value: ProjectForm[K]) => void;
  catalog: Catalog;
  errorFor: (field: string) => string | null;
};

/** One line under the field it belongs to; the field points at it with aria-describedby. */
export function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} className="text-cap text-danger">
      {message}
    </p>
  );
}

/** An empty pill in the shape of the chips it will hold ("Add what people get", "Add up to 7"). */
export const GhostPill = forwardRef<HTMLButtonElement, ComponentProps<"button"> & { invalid?: boolean }>(function GhostPill(
  { children, invalid, className = "", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      data-invalid={invalid || undefined}
      className={`pick pick-empty tap relative inline-flex h-chip items-center gap-[6px] whitespace-nowrap rounded-full pl-[10px] pr-[12px] text-cap ${className}`}
      {...rest}
    >
      <Plus size={14} strokeWidth={2} className="text-primary" aria-hidden="true" />
      {children}
    </button>
  );
});

/** The one "change this list" control: a round pencil after the chips or in a card's header. */
export const PencilButton = forwardRef<HTMLButtonElement, ComponentProps<"button">>(function PencilButton(
  { className = "", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`pick tap relative inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full border border-line bg-card text-muted hover:text-ink ${className}`}
      {...rest}
    >
      <Pencil size={14} strokeWidth={2} aria-hidden="true" />
    </button>
  );
});

const supportsFieldSizing = () => typeof CSS !== "undefined" && CSS.supports("field-sizing", "content");

/** Grows a textarea with its text in browsers without CSS field-sizing (Safari before 26.2, Firefox before 152). */
export function useAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string | null) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || supportsFieldSizing()) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [ref, value]);
}
