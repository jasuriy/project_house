"use client";

import { useState } from "react";

/** "Ulashish": copies the page address; the label turns into "Nusxalandi" for two seconds. */
export function ShareButton({ label, copiedLabel }: { label: string; copiedLabel: string }) {
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
      className="inline-flex min-h-11 items-center rounded-control text-small text-primary hover:underline md:min-h-0"
    >
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
