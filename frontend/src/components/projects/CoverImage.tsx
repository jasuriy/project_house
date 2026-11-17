"use client";

import { Play } from "lucide-react";
import { useState } from "react";

/**
 * The 16:9 cover of a project card. A missing or broken image falls back to the neutral
 * placeholder; videos get the play mark (design-guide section 6, mockup `.ph .play`).
 */
export function CoverImage({
  src,
  alt,
  isVideo,
  videoLabel,
}: {
  src: string | null;
  alt: string;
  isVideo: boolean;
  videoLabel: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = src !== null && !failed;

  return (
    <div className="relative aspect-video overflow-hidden bg-muted">
      {showImage && (
        // Covers come from about 15 hosts (GitHub, YouTube, project sites); next/image would need
        // open remotePatterns, so a plain lazy <img> is used (plan, Global Constraints).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {isVideo && (
        <span
          role="img"
          aria-label={videoLabel}
          className="absolute top-1/2 left-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-card text-fg"
        >
          <Play aria-hidden size={14} fill="currentColor" strokeWidth={0} className="ml-0.5" />
        </span>
      )}
    </div>
  );
}
