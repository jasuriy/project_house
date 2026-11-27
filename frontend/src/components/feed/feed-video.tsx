"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The card's preview, playing on its own while the card is on screen, as on Instagram (Bek,
 * 2026-11-27, D34): silent, looping, a few seconds long (made by the backend, app/previews.py).
 *
 * - It lies over the first frame and fades in only once it really plays, so there is no black
 *   flash, and the first frame stays when playing is not possible (iOS Low Power Mode).
 * - Nothing is downloaded before the card first reaches the screen (preload="none").
 * - Half the picture on screen: it plays; less: it pauses. It also pauses whenever the feed is
 *   hidden but kept in memory (cacheComponents), because hiding runs the effect's cleanup.
 * - It takes no focus and no clicks: clicks, right-clicks and long-presses reach the card's link.
 * - With "reduce motion" or the browser's data saver on, it never plays: the first frame stays.
 */
export function FeedVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduceMotion || saveData) return;
    // Set on the element itself: React's muted prop does not always reach it, and browsers only
    // allow videos to start on their own when they are muted.
    video.muted = true;
    const observer = new IntersectionObserver(
      (entries) => {
        const latest = entries[entries.length - 1];
        // The ratio, not isIntersecting: by the standard that is true from the first visible pixel.
        if (latest.intersectionRatio >= 0.5) video.play().catch(() => {}); // refused: frame stays
        else video.pause();
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      aria-hidden="true"
      onPlaying={() => setPlaying(true)}
      onEmptied={() => setPlaying(false)} // a new clip fades in again instead of cutting in
      className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.02] motion-reduce:transition-none ${playing ? "opacity-100" : "opacity-0"}`}
    />
  );
}
