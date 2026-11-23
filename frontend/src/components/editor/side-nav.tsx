"use client";

import { useEffect, useState } from "react";
import { StatusDot } from "@/components/ui/icons";
import { SECTIONS, type SectionId, isComplete } from "./sections";

/** Jump links to the four parts of the form, with a tick when a part is complete. */
export function SideNav({ missing }: { missing: Set<string> }) {
  const [active, setActive] = useState<SectionId>("details");

  // Highlight the part that is currently at the top of the screen.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id as SectionId);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    for (const s of SECTIONS) {
      const element = document.getElementById(s.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <nav aria-label="Form sections" className="sticky top-[12px] self-start">
      <ul className="flex flex-col gap-[3px]">
        {SECTIONS.map(({ id, label, icon: Icon, fields }) => {
          const current = id === active;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                onClick={() => setActive(id)}
                aria-current={current ? "location" : undefined}
                className={`flex h-[37px] items-center gap-[8px] rounded-[8px] pl-[18px] pr-[11px] text-[12.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 ${
                  current ? "bg-primary-tint font-semibold text-primary-strong" : "font-medium text-ink-2 hover:bg-black/[0.03]"
                }`}
              >
                <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
                <span className="flex-1 whitespace-nowrap">{label}</span>
                <StatusDot done={isComplete(fields, missing)} size={16} />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
