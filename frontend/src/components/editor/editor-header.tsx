import { LoaderCircle } from "lucide-react";
import { LogoMark } from "@/components/ui/icons";
import { READY_PARTS } from "./sections";

// The logo is not a link here: leaving the upload page empties the form (D24). "Draft saved" is left
// out on purpose: nothing is saved before Render.
export function EditorHeader({
  done,
  onRender,
  rendering = false,
  status = "",
}: {
  done?: boolean[];
  onRender?: () => void;
  rendering?: boolean;
  status?: string;
}) {
  const count = done?.filter(Boolean).length ?? 0;
  const left = READY_PARTS.filter((_, i) => done && !done[i]).map((p) => p.label);
  return (
    <header className="bg-card shadow-[0_1px_0_var(--color-line)]">
      <div className="mx-auto flex h-[52px] max-w-[1920px] items-center justify-between gap-[16px] px-[16px] sm:px-[48px]">
        <span className="inline-flex h-[44px] items-center gap-[8px] text-[17px] font-bold text-ink">
          <LogoMark />
          Prostagram
        </span>
        <div className="flex items-center gap-[16px]">
          {done && (
            <div className="flex items-center gap-[8px] whitespace-nowrap text-[13px] leading-[20px] text-muted max-sm:hidden">
              <span>
                <b className="font-semibold text-ink">
                  {count} of {READY_PARTS.length}
                </b>{" "}
                ready
              </span>
              {/* A progress bar: as many segments fill from the left as parts are ready, whichever they are
                  (Bek, 2026-11-25). Hovering it lists what is still to do. */}
              <div
                role="progressbar"
                aria-label="Parts ready"
                aria-valuemin={0}
                aria-valuemax={READY_PARTS.length}
                aria-valuenow={count}
                aria-valuetext={left.length ? `${count} of ${READY_PARTS.length} ready. To do: ${left.join(", ")}` : "All parts ready"}
                title={left.length ? `To do: ${left.join(", ")}` : "All parts ready"}
                className="flex gap-[4px]"
              >
                {READY_PARTS.map((part, i) => (
                  <span
                    key={part.label}
                    className={`h-[4px] w-[16px] rounded-[2px] transition-colors duration-300 ${i < count ? "bg-primary" : "bg-track"}`}
                  />
                ))}
              </div>
            </div>
          )}
          {done && (
            // Phone: the count alone (the page is long there, so it matters most); the bar is desktop only.
            <span aria-label={`${count} of ${READY_PARTS.length} parts ready`} className="text-[13px] font-semibold text-ink sm:hidden">
              {count}/{READY_PARTS.length}
            </span>
          )}
          <p aria-live="polite" className="sr-only">
            {status}
          </p>
          <button
            type="button"
            onClick={onRender}
            disabled={rendering || !onRender}
            className="inline-flex h-[36px] items-center justify-center gap-[8px] whitespace-nowrap rounded-[8px] bg-primary px-[16px] text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(79,70,229,0.25),0_4px_12px_rgba(79,70,229,0.2)] outline-none transition-colors hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-70 max-sm:h-[44px]"
          >
            {rendering && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />}
            Render project
          </button>
        </div>
      </div>
    </header>
  );
}
