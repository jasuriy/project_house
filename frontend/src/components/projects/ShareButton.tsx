"use client";

import { useState } from "react";

/** "Ulashish": copies the page address; the label turns into "Nusxalandi" for two seconds. */
const LINK_STYLE =
  "inline-flex min-h-11 items-center rounded-control text-small text-primary hover:underline md:min-h-0";

/** `className` replaces the default text-link look (the profile shows it as a button). */
export function ShareButton({
  label,
  copiedLabel,
  className = LINK_STYLE,
}: {
  label: string;
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure context, permissions); the address bar still works.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={className}
    >
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
