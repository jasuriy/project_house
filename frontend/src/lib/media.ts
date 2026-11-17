import type { Cover, MediaItem } from "./types";

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com"];

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** The 11-character video id of a YouTube watch, youtu.be, /embed/ or /shorts/ URL, else null. */
export function youtubeId(url: string): string | null {
  const parsed = parse(url);
  if (!parsed) return null;
  let candidate: string | null = null;
  if (parsed.hostname === "youtu.be") {
    candidate = parsed.pathname.slice(1);
  } else if (YOUTUBE_HOSTS.includes(parsed.hostname)) {
    const [, first, second] = parsed.pathname.split("/");
    if (first === "watch") candidate = parsed.searchParams.get("v");
    else if (first === "embed" || first === "shorts") candidate = second ?? null;
  }
  return candidate && YOUTUBE_ID.test(candidate) ? candidate : null;
}

/**
 * What a feed card shows: a YouTube thumbnail, the image itself, or no picture (`src` null,
 * the card draws its placeholder). `isVideo` adds the play icon.
 */
export function coverImage(cover: Cover | null): {
  src: string | null;
  isVideo: boolean;
} {
  if (!cover) return { src: null, isVideo: false };
  if (cover.kind === "image") return { src: cover.url, isVideo: false };
  const id = youtubeId(cover.url);
  return {
    src: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null,
    isVideo: true,
  };
}

export type Embed =
  | { kind: "iframe"; src: string }
  | { kind: "video"; src: string }
  | { kind: "image"; src: string }
  | { kind: "link"; src: string };

function iframeSrc(url: string): string | null {
  const youtube = youtubeId(url);
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube}`;
  const parsed = parse(url);
  if (!parsed) return null;
  const host = parsed.hostname.replace(/^www\./, "");
  const [, first, second] = parsed.pathname.split("/");
  if (host === "loom.com" && (first === "share" || first === "embed") && second) {
    return `https://www.loom.com/embed/${second}`;
  }
  if (host === "vimeo.com" && /^\d+$/.test(first ?? "")) {
    return `https://player.vimeo.com/video/${first}`;
  }
  if (host === "player.vimeo.com" && first === "video" && /^\d+$/.test(second ?? "")) {
    return `https://player.vimeo.com/video/${second}`;
  }
  return null;
}

/** How the project page plays one media item. Anything it cannot embed is a plain link. */
export function embedFor(media: MediaItem): Embed {
  if (media.kind === "image") return { kind: "image", src: media.url };
  const iframe = iframeSrc(media.url);
  if (iframe) return { kind: "iframe", src: iframe };
  if (parse(media.url)?.pathname.toLowerCase().endsWith(".mp4")) {
    return { kind: "video", src: media.url };
  }
  return { kind: "link", src: media.url };
}
