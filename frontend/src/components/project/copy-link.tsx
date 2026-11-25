"use client";

import { Link2 } from "lucide-react";
import { useEffect, useState } from "react";

/** Copies the page address; the label says "Link copied" for two seconds. */
export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // The clipboard can be refused (permissions, insecure page): the label then stays as it was.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex h-[36px] items-center gap-[8px] rounded-[8px] border border-line bg-card px-[12px] text-[13px] font-semibold text-ink outline-none transition-colors hover:bg-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary max-sm:h-[44px]"
    >
      <Link2 size={16} strokeWidth={2} aria-hidden="true" />
      <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
    </button>
  );
}
