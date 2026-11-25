"use client";

import { type SyntheticEvent, useState } from "react";
import { flushSync } from "react-dom";
import type { Video } from "@/lib/api";

// The demo video uses the browser's own player controls (play, pause, time) and never starts by
// itself; when it ends it goes back to its first frame. Signed video links last one hour, so a
// page left open longer fetches fresh links when play is pressed.

const LINK_REFRESH_MS = 50 * 60 * 1000;

export function DemoVideo({ slug, video }: { slug: string; video: Video | null }) {
  const [links, setLinks] = useState(video);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  if (!links) {
    return (
      <div className="flex h-full w-full items-center justify-center text-cap text-muted">
        No demo video
      </div>
    );
  }

  async function refreshIfOld(event: SyntheticEvent<HTMLVideoElement>) {
    if (Date.now() - loadedAt <= LINK_REFRESH_MS) return;
    const element = event.currentTarget;
    element.pause();
    const response = await fetch(`/api/v1/projects/by-slug/${encodeURIComponent(slug)}/video`);
    if (!response.ok) return;
    const fresh: Video = await response.json();
    // React owns the src attribute: apply the new link now (flushSync), so React does not write
    // it again after play() starts, which would restart loading and stop the video.
    flushSync(() => {
      setLinks(fresh);
      setLoadedAt(Date.now());
    });
    await element.play().catch(() => {});
  }

  return (
    // The frame (size, corners, shadow) belongs to the page around it.
    <div className="h-full w-full bg-[#17162f]">
      <video
        src={links.url}
        poster={links.poster_url ?? undefined}
        preload="metadata"
        playsInline
        controls
        onPlay={(e) => void refreshIfOld(e)}
        onEnded={(e) => e.currentTarget.load()}
        className="h-full w-full object-contain"
        aria-label="Demo video"
      />
    </div>
  );
}
