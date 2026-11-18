"use client";

import { useState, type ReactNode } from "react";

/** "Projects (N)" and, when the person wrote one, "About" (mockup 3 tabs). */
export function ProfileTabs({
  projectsLabel,
  aboutLabel,
  about,
  children,
}: {
  projectsLabel: string;
  aboutLabel: string;
  about: string | null;
  children: ReactNode;
}) {
  const [tab, setTab] = useState<"projects" | "about">("projects");
  const tabs = about ? (["projects", "about"] as const) : (["projects"] as const);
  return (
    <div className="min-w-0">
      <div className="mb-5 flex gap-6 border-b border-border">
        {tabs.length === 1 && (
          // Nothing to switch to: a label with the tab look, not a button that does nothing.
          <h2 className="py-2.5 text-ui font-semibold text-fg shadow-[inset_0_-2px_0_var(--color-primary)]">
            {projectsLabel}
          </h2>
        )}
        {tabs.length > 1 && tabs.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={tab === name}
            onClick={() => setTab(name)}
            className={`min-h-11 py-2.5 text-ui ${
              tab === name ? "font-semibold text-fg shadow-[inset_0_-2px_0_var(--color-primary)]" : "text-mute hover:text-fg"
            }`}
          >
            {name === "projects" ? projectsLabel : aboutLabel}
          </button>
        ))}
      </div>
      {/* Both panels stay mounted, so projects loaded with "load more" survive a visit to About. */}
      <div hidden={tab !== "projects"}>{children}</div>
      {about && (
        <p hidden={tab !== "about"} className="text-body whitespace-pre-line break-words text-fg">
          {about}
        </p>
      )}
    </div>
  );
}
