import { ArrowRight, ChevronRight, CircleAlert, House, LoaderCircle } from "lucide-react";
import { LogoMark, StatusDot } from "@/components/ui/icons";
import type { SaveState } from "@/lib/use-project-draft";

export function EditorHeader({
  saveState = "idle",
  saveError,
  onRender,
  rendering = false,
}: {
  saveState?: SaveState;
  saveError?: string | null;
  onRender?: () => void;
  rendering?: boolean;
}) {
  return (
    <header className="relative flex h-[42px] items-center border-b border-[#f0ebea] pl-[38px] pr-[30px]">
      <div className="flex items-center gap-[7px]">
        <LogoMark size={23} />
        <span className="text-[19px] font-extrabold tracking-[-0.015em] text-ink">Prostagram</span>
      </div>

      <nav
        aria-label="Breadcrumb"
        className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-[7px] text-[12.3px] text-ink-2 md:flex"
      >
        <House size={15} strokeWidth={1.8} aria-label="Home" />
        <ChevronRight size={13} strokeWidth={2} aria-hidden="true" className="text-muted" />
        <span>Workspace</span>
        <span className="px-[3px] text-muted">/</span>
        <span aria-current="page">New project</span>
      </nav>

      <div className="ml-auto flex items-center gap-[27px]">
        <SaveStatus state={saveState} error={saveError} />
        <button
          type="button"
          onClick={onRender}
          disabled={rendering}
          className="inline-flex h-[29px] items-center gap-[8px] rounded-[6px] bg-primary px-[20px] text-[12px] font-bold text-white shadow-[0_1px_2px_rgba(59,50,219,0.25)] outline-none transition-colors hover:bg-primary-strong focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-70"
        >
          {rendering ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}
          Render project
          <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

function SaveStatus({ state, error }: { state: SaveState; error?: string | null }) {
  if (state === "idle") return null;
  return (
    <span role="status" className="flex items-center gap-[7px] text-[12.3px] text-ink-2">
      {state === "saving" && <LoaderCircle size={15} className="animate-spin text-muted" aria-hidden="true" />}
      {state === "saved" && <StatusDot done size={16} />}
      {state === "error" && <CircleAlert size={16} className="text-danger" aria-hidden="true" />}
      <span title={error ?? undefined}>
        {state === "saving" ? "Saving..." : state === "saved" ? "Draft saved" : "Not saved"}
      </span>
    </span>
  );
}
