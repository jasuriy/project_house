"use client";

import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from "react";

type Trigger = { open: boolean; toggle: () => void; panelId: string };

const isPhone = () => typeof window !== "undefined" && window.matchMedia("(width < 40rem)").matches;

/**
 * A small panel under its trigger (the dates, deliverables and stack choosers); on a phone a bottom
 * sheet over a dimmed page, with a Done button. It closes on a click outside or Escape; focus moves
 * into it when it opens (on a phone to the panel itself, so the keyboard does not cover the sheet) and
 * back to whatever opened it on Escape. Pass `open` and `onOpenChange` when buttons elsewhere open it
 * too (Built with's empty rows).
 */
export function Popover({
  trigger,
  label,
  align = "left",
  width = 360,
  open: controlledOpen,
  onOpenChange,
  panelClassName,
  fill,
  children,
}: {
  trigger: (t: Trigger) => ReactNode;
  label: string;
  align?: "left" | "right";
  width?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Place the panel against the nearest positioned ancestor instead of the trigger (with its own classes). */
  panelClassName?: string;
  /** The trigger takes the full width and the panel matches it (a field's chooser). */
  fill?: boolean;
  children: ReactNode;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const setOpen = (next: boolean) => (onOpenChange ? onOpenChange(next) : setOwnOpen(next));
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    const close = () => (onOpenChange ? onOpenChange(false) : setOwnOpen(false));
    const outside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      // The opener may be gone (the first choice turns "Add what people get" into the pencil).
      const opener = openerRef.current?.isConnected ? openerRef.current : rootRef.current?.querySelector<HTMLElement>("[aria-controls]");
      opener?.focus();
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    const panel = panelRef.current;
    if (isPhone()) panel?.focus();
    // The first field (a search box, a date) rather than a chip's remove button above it.
    else (panel?.querySelector<HTMLElement>("input:not([disabled])") ?? panel?.querySelector<HTMLElement>("button, select, textarea"))?.focus();
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onOpenChange]);

  const place =
    panelClassName ?? (fill ? "inset-x-0 top-[calc(100%+8px)]" : `top-[calc(100%+8px)] w-(--pw) ${align === "right" ? "right-0" : "left-0"}`);
  const rootClass = panelClassName ? "inline-flex" : fill ? "relative flex w-full flex-col" : "relative inline-flex";
  return (
    <div ref={rootRef} className={rootClass}>
      {trigger({ open, toggle: () => setOpen(!open), panelId })}
      {open && (
        <>
          <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-ink/30 sm:hidden" />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            style={{ "--pw": `${width}px` } as CSSProperties}
            className={`absolute z-30 rounded-[12px] border border-line bg-card p-[12px] shadow-[0_12px_32px_-12px_rgba(23,22,47,0.28)] outline-none ${place} max-sm:fixed max-sm:inset-x-[16px] max-sm:top-auto max-sm:bottom-[16px] max-sm:z-40 max-sm:w-auto max-sm:max-h-[75dvh] max-sm:overflow-y-auto max-sm:p-[16px]`}
          >
            {children}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-[16px] h-[44px] w-full rounded-[8px] bg-primary text-[15px] font-semibold text-white sm:hidden"
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}
