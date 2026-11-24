import { Info, Sparkle } from "lucide-react";
import { StatusDot } from "@/components/ui/icons";
import { SECTIONS, isComplete } from "./sections";

export function ReadyCard({ missing }: { missing: Set<string> }) {
  return (
    <>
      <section
        aria-labelledby="ready-title"
        className="rounded-[10px] border border-[#e6dffb] bg-primary-tint px-[16px] pb-[11px] pt-[9px]"
      >
        <h2 id="ready-title" className="flex items-center gap-[12px] text-[16.5px] font-extrabold tracking-[-0.01em] text-ink">
          <Sparkle size={21} strokeWidth={1.7} className="text-primary" aria-hidden="true" />
          Ready to render
        </h2>
        <ul className="mt-[8px] grid grid-cols-1 gap-x-[20px] gap-y-[10px] pl-[13px] sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <li key={section.id} className="flex items-center gap-[10px] text-[12.2px] text-ink-2">
              <StatusDot done={isComplete(section.fields, missing)} size={18} />
              {section.ready}
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-[18px] flex items-center gap-[10px] pl-[3px] text-[11.3px] text-muted">
        <Info size={17} strokeWidth={1.7} aria-hidden="true" className="text-ink-2" />
        Review your details, then click Render project.
      </p>
    </>
  );
}
