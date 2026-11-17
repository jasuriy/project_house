import { describe, expect, it } from "vitest";
import { coverImage, embedFor, youtubeId } from "@/lib/media";
import type { MediaItem } from "@/lib/types";

const ID = "et5yQABJ3xI";

function item(kind: "image" | "video", url: string): MediaItem {
  return { kind, url, position: 0, alt: null };
}

describe("youtubeId", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, ID],
    [`https://www.youtube.com/watch?v=${ID}&t=42s`, ID],
    [`https://youtu.be/${ID}`, ID],
    [`https://www.youtube.com/embed/${ID}`, ID],
    [`https://www.youtube.com/shorts/${ID}`, ID],
  ])("reads %s", (url, expected) => {
    expect(youtubeId(url)).toBe(expected);
  });

  it.each([
    "https://www.youtube.com/watch",
    "https://www.youtube.com/watch?v=short",
    "https://evil.com/watch?v=" + ID,
    "https://example.com/youtube.com/watch?v=" + ID,
    "not a url",
    "",
  ])("rejects %j", (url) => {
    expect(youtubeId(url)).toBeNull();
  });
});

describe("coverImage", () => {
  it("has no cover: placeholder, not a video", () => {
    expect(coverImage(null)).toEqual({ src: null, isVideo: false });
  });

  it("uses the thumbnail of a YouTube video", () => {
    expect(coverImage({ kind: "video", url: `https://youtu.be/${ID}` })).toEqual({
      src: `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`,
      isVideo: true,
    });
  });

  it("has no picture for any other video", () => {
    expect(
      coverImage({ kind: "video", url: "https://host.example/demo.mp4" }),
    ).toEqual({ src: null, isVideo: true });
  });

  it("uses the url of an image", () => {
    expect(
      coverImage({ kind: "image", url: "https://host.example/demo.gif" }),
    ).toEqual({ src: "https://host.example/demo.gif", isVideo: false });
  });
});

describe("embedFor", () => {
  it.each([
    [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}`,
    ],
    [
      "https://www.loom.com/share/0123456789abcdef0123456789abcdef",
      "https://www.loom.com/embed/0123456789abcdef0123456789abcdef",
    ],
    ["https://vimeo.com/76979871", "https://player.vimeo.com/video/76979871"],
  ])("embeds %s", (url, src) => {
    expect(embedFor(item("video", url))).toEqual({ kind: "iframe", src });
  });

  it("plays an .mp4 in a video element", () => {
    const url = "https://host.example/clip.mp4?x=1";
    expect(embedFor(item("video", url))).toEqual({ kind: "video", src: url });
  });

  it("shows an image kind as an image", () => {
    const url = "https://host.example/shot.gif";
    expect(embedFor(item("image", url))).toEqual({ kind: "image", src: url });
  });

  it("falls back to a link for an unknown video host or garbage", () => {
    expect(embedFor(item("video", "https://host.example/page"))).toEqual({
      kind: "link",
      src: "https://host.example/page",
    });
    expect(embedFor(item("video", "garbage"))).toEqual({
      kind: "link",
      src: "garbage",
    });
  });
});
