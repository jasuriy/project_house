"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { MouseEvent } from "react";

// The Navigation API is not in TypeScript's DOM types yet; only the part used here is declared.
type NavigationLike = {
  currentEntry: { index: number } | null;
  entries(): { key: string; url: string | null }[];
  traverseTo(key: string): unknown;
};

// The pages Back may return to: the feed, a project, a profile. Named, not excluded, so a page added
// later (settings, an edit page) is never a Back target by accident; the upload, login and sign-up
// pages are steps of a task, not something to read.
const isReadingPage = (path: string) => path === "/" || /^\/(projects|u)\/[^/]+$/.test(path);

/**
 * The history entry just before this one in the tab when it is a page to read, else null.
 * entries() lists only this site's pages, so another site never counts.
 */
function readingEntryBefore(nav: NavigationLike): string | null {
  const index = nav.currentEntry?.index ?? 0;
  if (index < 1) return null;
  const previous = nav.entries()[index - 1];
  if (!previous?.url) return null;
  return isReadingPage(new URL(previous.url).pathname) ? previous.key : null;
}

/**
 * "Back" above a project or a profile (Bek, 2026-11-27, D33; extended to profiles the same day).
 * The logo already goes home, so Back does what the logo cannot: it returns to the page the reader
 * came from (the feed with its category, search and scroll; a project; a profile). In every other
 * case (a shared link opened fresh, the upload page after Render, the login page, a browser without
 * the Navigation API) it is a plain link to the feed.
 */
export function BackLink() {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Ctrl/Cmd/Shift-click and middle-click keep their own meaning (open in a new tab or window).
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const nav = (window as { navigation?: NavigationLike }).navigation;
    const target = nav && readingEntryBefore(nav);
    if (!nav || !target) return;
    e.preventDefault();
    // Going to that exact entry, not "one step back": a double-click then lands there twice instead
    // of stepping past it.
    nav.traverseTo(target);
  };
  return (
    <Link
      href="/"
      onClick={onClick}
      // focus-visible:outline-solid is needed: outline-none sets the outline style variable to none,
      // which focus-visible:outline-2 alone would reuse, leaving no ring.
      className="tap relative mb-[calc(var(--gs)-4px)] -mt-[4px] flex h-[32px] w-fit items-center gap-[6px] rounded-[8px] text-body font-medium text-muted outline-none transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-primary"
    >
      <ArrowLeft strokeWidth={2} aria-hidden="true" className="size-[1em]" />
      Back
    </Link>
  );
}
