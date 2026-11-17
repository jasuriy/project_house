import type { ReactNode } from "react";

const TONE = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn-fg",
  info: "bg-accent-soft text-fg",
} as const;

/** The banners of the account screens (auth mockup `.banner`): success, problem, information. */
export function Banner({ tone, children }: { tone: keyof typeof TONE; children: ReactNode }) {
  return (
    <p role={tone === "warn" ? "alert" : "status"} className={`rounded-media px-3.5 py-3 text-small ${TONE[tone]}`}>
      {children}
    </p>
  );
}
