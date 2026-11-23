import { ArrowRight, ChevronRight, House, LoaderCircle } from "lucide-react";
import { LogoMark } from "@/components/ui/icons";

// The mockup's "Draft saved" status is left out on purpose: nothing is saved before Render
// (Bek, 2026-11-24).
export function EditorHeader({ onRender, rendering = false }: { onRender?: () => void; rendering?: boolean }) {
  return (
    <header className="relative flex h-[52px] items-center border-b border-[#f0ebea] px-[16px] md:h-[42px] md:pl-[38px] md:pr-[30px]">
      <div className="flex items-center gap-[7px]">
        <LogoMark size={23} />
        <span className="text-[19px] font-extrabold tracking-[-0.015em] text-ink">Prostagram</span>
      </div>

      <nav
        aria-label="Breadcrumb"
        className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-[7px] text-[12.3px] text-ink-2 lg:flex"
      >
        <House size={15} strokeWidth={1.8} aria-label="Home" />
        <ChevronRight size={13} strokeWidth={2} aria-hidden="true" className="text-muted" />
        <span>Workspace</span>
        <span className="px-[3px] text-muted">/</span>
        <span aria-current="page">New project</span>
      </nav>

      <div className="ml-auto flex items-center">
        <button
          type="button"
          onClick={onRender}
          disabled={rendering}
          className="inline-flex h-[40px] items-center gap-[8px] rounded-[6px] bg-primary px-[14px] text-[13px] md:h-[29px] md:px-[20px] md:text-[12px] font-bold text-white shadow-[0_1px_2px_rgba(59,50,219,0.25)] outline-none transition-colors hover:bg-primary-strong focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-70"
        >
          {rendering ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}
          Render project
          <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
