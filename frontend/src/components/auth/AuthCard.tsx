import type { ReactNode } from "react";

/** The centred white card of the account screens (auth mockup `.auth`: 440 px, 520 for sign up).
    Without `title` the content renders its own heading (screens whose title changes with state). */
export function AuthCard({
  title,
  sub,
  wide = false,
  children,
}: {
  title?: string;
  sub?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`mx-auto grid w-full gap-5 rounded-card border border-border bg-card p-5 md:p-8 lg:mt-7 ${
        wide ? "max-w-[520px]" : "max-w-[440px]"
      }`}
    >
      {title && (
        <div>
          <h1 className="text-h2 font-bold tracking-[-0.015em] text-fg">{title}</h1>
          {sub && <p className="mt-1 text-ui text-mute">{sub}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
