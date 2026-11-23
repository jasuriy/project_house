"use client";

import { Play } from "lucide-react";
import { type ReactNode, type RefObject, createContext, useContext, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Video } from "@/lib/api";
import { formatDuration } from "@/lib/upload";

// "Try demo" (top of the page) and the video box (further down) share one player:
// - the video never starts by itself;
// - "Try demo" scrolls to the video and plays it, with the player controls shown;
// - when it ends it goes back to its first frame; watching again needs another "Try demo".
// Signed video links last one hour, so a page left open longer asks for fresh links first.

const LINK_REFRESH_MS = 50 * 60 * 1000;

type Player = {
  videoRef: RefObject<HTMLVideoElement | null>;
  links: Video | null;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  play: () => Promise<void>;
};

const PlayerContext = createContext<Player | null>(null);

function usePlayer(): Player {
  const player = useContext(PlayerContext);
  if (!player) throw new Error("Use inside <DemoPlayer>");
  return player;
}

export function DemoPlayer({ slug, video, children }: { slug: string; video: Video | null; children: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [links, setLinks] = useState(video);
  const [loadedAt] = useState(() => Date.now());
  const [playing, setPlaying] = useState(false);

  async function play() {
    const element = videoRef.current;
    if (!element || !links) return;
    if (Date.now() - loadedAt > LINK_REFRESH_MS) {
      const response = await fetch(`/api/v1/projects/by-slug/${encodeURIComponent(slug)}/video`);
      if (response.ok) {
        const fresh: Video = await response.json();
        // React owns the src attribute: apply the new link now (flushSync), so React does not
        // write it again after play() starts, which would restart loading and stop the video.
        flushSync(() => setLinks(fresh));
      }
    }
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setPlaying(true);
    await element.play().catch(() => setPlaying(false));
  }

  return (
    <PlayerContext.Provider value={{ videoRef, links, playing, setPlaying, play }}>{children}</PlayerContext.Provider>
  );
}

export function TryDemoButton() {
  const { play, links } = usePlayer();
  return (
    <button
      type="button"
      onClick={() => void play()}
      disabled={!links}
      className="inline-flex h-[34px] w-[132px] items-center justify-center gap-[11px] rounded-[7px] bg-[#4a43c4] text-[13px] font-bold text-white shadow-[0_1px_2px_rgba(59,50,219,0.3)] outline-none transition-colors hover:bg-primary-strong focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60 max-sm:h-[44px]"
    >
      <Play size={15} fill="currentColor" strokeWidth={0} aria-hidden="true" />
      Try demo
    </button>
  );
}

/** The video box: first frame and length until "Try demo"; then the video with its controls. */
export function VideoStage() {
  const { videoRef, links, playing, setPlaying } = usePlayer();
  if (!links) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-[8px] bg-[#1c1d33] text-[14px] text-white/70">
        No demo video
      </div>
    );
  }
  return (
    <div className="relative aspect-video overflow-hidden rounded-[8px] bg-[#1c1d33]">
      <video
        ref={videoRef}
        src={links.url}
        poster={links.poster_url ?? undefined}
        preload="metadata"
        playsInline
        controls={playing}
        onEnded={(e) => {
          setPlaying(false);
          e.currentTarget.load(); // back to the first frame
        }}
        className="h-full w-full object-contain"
        aria-label="Demo video"
      />
      {!playing && links.duration_seconds !== null && (
        <span className="absolute bottom-[10px] right-[9px] rounded-[7px] bg-[#2b2b33]/90 px-[10px] py-[3px] text-[15px] font-medium text-white">
          {formatDuration(links.duration_seconds)}
        </span>
      )}
    </div>
  );
}
