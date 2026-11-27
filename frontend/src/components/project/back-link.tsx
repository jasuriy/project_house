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

/**
 * The feed's history entry when it is the page just before this one in the tab, else null.
 * entries() lists only this site's pages, so a page from another site never counts. Any other earlier
 * page (the upload page after Render, another project) does not count either: stepping back there
 * would not be "back to projects".
 */
function feedEntryBefore(nav: NavigationLike): string | null {
  const index = nav.currentEntry?.index ?? 0;
  if (index < 1) return null;
  const previous = nav.entries()[index - 1];
  return previous?.url && new URL(previous.url).pathname === "/" ? previous.key : null;
}

/**
 * "Back" above the project (Bek, 2026-11-27, D33). The logo already goes home, so Back does what the
 * logo cannot: when the reader came from the feed, it returns to that history entry, with the feed's
 * category, search and scroll as they were. In every other case (a shared link opened fresh, the
 * upload page after Render, a browser without the Navigation API) it is a plain link to the feed.
 */
export function BackLink() {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Ctrl/Cmd/Shift-click and middle-click keep their own meaning (open in a new tab or window).
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const nav = (window as { navigation?: NavigationLike }).navigation;
    const feed = nav && feedEntryBefore(nav);
    if (!nav || !feed) return;
    e.preventDefault();
    // Going to that exact entry, not "one step back": a double-click then lands on the feed twice
    // instead of stepping past it.
    nav.traverseTo(feed);
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
