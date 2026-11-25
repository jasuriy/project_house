"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { TechIcon } from "@/components/ui/icons";

type Tech = { name: string; icon: string | null };

const GAP = 12; // px between items, the same as gap-x-[12px] below

/**
 * The card's stack on exactly one line: as many technologies as fit the card's width, then "+N".
 * The widths are measured in the browser (letter counts do not predict them: "C++" is wide, "Rust"
 * narrow), again whenever the card changes size. Before measuring, the row is clipped to one line.
 */
export function StackLine({ items }: { items: Tech[] }) {
  const rowRef = useRef<HTMLUListElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);
  const moreRef = useRef<HTMLLIElement>(null);
  const [shown, setShown] = useState(items.length);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    const fit = () => {
      const all = [...measure.querySelectorAll<HTMLElement>("[data-measure]")].map((el) => el.offsetWidth);
      const moreWidth = (moreRef.current?.offsetWidth ?? 24) + GAP;
      const room = row.clientWidth;
      let used = 0;
      let count = 0;
      for (let i = 0; i < all.length; i++) {
        const next = used + (count ? GAP : 0) + all[i];
        const restHidden = i < all.length - 1;
        // Keep room for "+N" unless this is the last one.
        if (next + (restHidden ? moreWidth : 0) > room) break;
        used = next;
        count++;
      }
      setShown(Math.max(1, count));
    };
    fit();
    void document.fonts?.ready.then(fit); // widths change once the web font arrives
    const observer = new ResizeObserver(fit);
    observer.observe(row);
    return () => observer.disconnect();
  }, [items]);

  const hidden = items.length - shown;
  return (
    <div className="relative">
      {/* An invisible copy of every item, measured once per change; it takes no room. */}
      <ul ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex gap-x-[12px] whitespace-nowrap text-cap">
        {items.map((t) => (
          <li key={t.name} data-measure className="inline-flex items-center gap-[6px]">
            <TechIcon name={t.name} slug={t.icon} size={16} />
            {t.name}
          </li>
        ))}
        <li ref={moreRef}>+{items.length}</li>
      </ul>
      <ul ref={rowRef} aria-label="Built with" className="flex flex-nowrap items-center gap-x-[12px] overflow-hidden whitespace-nowrap text-cap text-ink-2">
        {items.slice(0, shown).map((t) => (
          <li key={t.name} className="inline-flex shrink-0 items-center gap-[6px]">
            <TechIcon name={t.name} slug={t.icon} size={16} />
            {t.name}
          </li>
        ))}
        {hidden > 0 && (
          <li className="shrink-0 text-muted">
            +{hidden}
            <span className="sr-only"> more: {items.slice(shown).map((t) => t.name).join(", ")}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
