"use client";

import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { coverImage, embedFor } from "@/lib/media";
import { safeExternalUrl } from "@/lib/safe-url";
import type { MediaItem } from "@/lib/types";

/**
 * The demo column of the project page (mockup `.ph.lg` + `.thumbs`): the selected media large,
 * the others as a 5-column thumbnail strip; the current thumbnail has the primary outline.
 */
export function MediaPlayer({ media, title }: { media: MediaItem[]; title: string }) {
  const t = useTranslations("Project");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const current = media[index];

  return (
    <div>
      <div data-focus-ring className="relative aspect-video overflow-hidden rounded-media bg-muted">
        {current && (
          <Stage
            item={current}
            title={title}
            openLabel={t("openMedia")}
            playLabel={t("play")}
            playing={playing}
            onPlay={() => setPlaying(true)}
          />
        )}
      </div>
      {media.length > 1 && (
        <ul aria-label={t("media")} className="mt-3 grid grid-cols-3 gap-2.5 md:grid-cols-5">
          {media.map((item, i) => {
            const thumb = coverImage({ kind: item.kind, url: item.url });
            return (
              <li key={`${item.position}-${item.url}`}>
                <button
                  type="button"
                  onClick={() => {
                    setIndex(i);
                    setPlaying(false);
                  }}
                  aria-label={t("showMedia", { n: i + 1 })}
                  aria-current={i === index ? "true" : undefined}
                  className={`relative block aspect-video w-full overflow-hidden rounded-chip bg-muted ${
                    i === index ? "outline-2 outline-offset-2 outline-primary" : ""
                  }`}
                >
                  {thumb.src && (
                    // Media come from many hosts; see the CoverImage comment.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb.src}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  {thumb.isVideo && (
                    <span className="absolute top-1/2 left-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-card text-fg">
                      <Play aria-hidden size={10} fill="currentColor" strokeWidth={0} className="ml-px" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stage({
  item,
  title,
  openLabel,
  playLabel,
  playing,
  onPlay,
}: {
  item: MediaItem;
  title: string;
  openLabel: string;
  playLabel: string;
  playing: boolean;
  onPlay: () => void;
}) {
  const embed = embedFor(item);
  if (embed.kind === "iframe" && !playing) {
    // The mockup's poster: thumbnail plus a large play button; the player loads on click.
    const poster = coverImage({ kind: "video", url: item.url }).src;
    return (
      <button type="button" onClick={onPlay} aria-label={playLabel} className="group absolute inset-0 rounded-media">
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster.replace("/hqdefault.jpg", "/maxresdefault.jpg")}
            alt=""
            referrerPolicy="no-referrer"
            onError={(event) => {
              const img = event.currentTarget;
              if (!img.src.endsWith("/hqdefault.jpg")) img.src = poster;
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <span className="absolute top-1/2 left-1/2 grid size-15.5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-fg/15 bg-card text-fg group-hover:text-primary">
          <Play aria-hidden size={26} fill="currentColor" strokeWidth={0} className="ml-1" />
        </span>
      </button>
    );
  }
  if (embed.kind === "iframe") {
    const src = embed.src + (embed.src.includes("?") ? "&" : "?") + "autoplay=1";
    return (
      <iframe
        src={src}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full border-0"
      />
    );
  }
  if (embed.kind === "video") {
    return (
      <video
        src={embed.src}
        controls
        preload="metadata"
        className="absolute inset-0 h-full w-full bg-fg object-contain"
      >
        <track kind="captions" />
      </video>
    );
  }
  if (embed.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={embed.src}
        alt={item.alt ?? title}
        referrerPolicy="no-referrer"
        className="absolute inset-0 h-full w-full object-contain"
      />
    );
  }
  const href = safeExternalUrl(embed.src);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute inset-0 grid place-items-center text-ui font-semibold text-primary"
    >
      {openLabel}
    </a>
  );
}
