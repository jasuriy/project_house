"use client";

import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type Dispatch, type SetStateAction, useId, useRef } from "react";
import { projectErrorKey } from "@/lib/project-errors";
import { discardUpload, IMAGE_TYPES, MAX_IMAGE_BYTES, uploadImage } from "@/lib/upload";

export const MAX_IMAGES = 6;

/** One tile: an image the project has (`media`), a finished upload (`upload`), or one in flight. */
export type ImageItem = {
  key: string;
  url: string;
  media?: number;
  upload?: string;
  uploading?: boolean;
  error?: string;
};

// 44 px on a phone (two tiles per row, 4:3, so a corner each fits), 32 px from 768 px.
const ICON_BUTTON =
  "absolute grid size-11 place-items-center rounded-full bg-card/90 text-fg shadow-sm hover:text-primary disabled:opacity-40 md:size-8";

/**
 * Rasmlar (mockup screen 4 `.drop`). Each picked file uploads at once (the backend re-encodes it);
 * a file that is too big or of the wrong type is refused here, before any upload.
 */
export function ImagePicker({
  images,
  setImages,
  error,
}: {
  images: ImageItem[];
  setImages: Dispatch<SetStateAction<ImageItem[]>>;
  error?: string;
}) {
  const t = useTranslations("Editor");
  const te = useTranslations("EditorErrors");
  const input = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const nextKey = useRef(0); // crypto.randomUUID needs https; a counter is enough for list keys
  const noteId = `${labelId}-note`;

  const update = (key: string, change: Partial<ImageItem>) =>
    setImages((list) => list.map((item) => (item.key === key ? { ...item, ...change } : item)));

  async function pick(files: FileList | null) {
    const room = MAX_IMAGES - images.length;
    for (const file of Array.from(files ?? []).slice(0, Math.max(room, 0))) {
      const key = `new${nextKey.current++}`;
      const local = URL.createObjectURL(file);
      const refused = !IMAGE_TYPES.includes(file.type)
        ? "invalid_image"
        : file.size > MAX_IMAGE_BYTES
          ? "image_too_large"
          : null;
      setImages((list) => [
        ...list,
        { key, url: local, uploading: !refused, error: refused ? te(refused) : undefined },
      ]);
      if (refused) continue;
      const result = await uploadImage(file);
      if (result.ok) {
        update(key, { uploading: false, upload: result.data.id, url: result.data.url });
        URL.revokeObjectURL(local);
      } else {
        update(key, { uploading: false, error: te(projectErrorKey(result.code)) });
      }
    }
    if (input.current) input.current.value = "";
  }

  function remove(image: ImageItem) {
    setImages((list) => list.filter((item) => item.key !== image.key));
    if (image.upload) discardUpload(image.upload); // free its place among the 12 unused uploads
    if (image.url.startsWith("blob:")) URL.revokeObjectURL(image.url);
  }

  function move(index: number, by: -1 | 1) {
    setImages((list) => {
      const next = [...list];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  }

  return (
    <div className="grid gap-1.5">
      <span id={labelId} className="text-small font-semibold text-fg">
        {t("images")}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={noteId}
        className={`grid grid-cols-2 gap-2 rounded-[10px] border border-dashed bg-card p-3.5 md:grid-cols-4 lg:grid-cols-6 ${
          error ? "border-danger" : "border-deco/40"
        }`}
      >
        {images.map((image, index) => (
          <div key={image.key} className="relative aspect-[4/3] overflow-hidden rounded-[6px] bg-muted md:aspect-video">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" className={`h-full w-full object-cover ${image.uploading || image.error ? "opacity-40" : ""}`} />
            {(image.uploading || image.error) && (
              <span
                role={image.error ? "alert" : "status"}
                className={`absolute top-1 right-13 left-1 rounded-[4px] bg-card/90 px-1 text-caption leading-tight md:right-10 ${image.error ? "text-danger" : "text-mute"}`}
              >
                {image.error ?? t("uploading")}
              </span>
            )}
            <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t("moveLeft")} className={`${ICON_BUTTON} bottom-1 left-1`}>
              <ChevronLeft aria-hidden size={16} />
            </button>
            <button type="button" onClick={() => move(index, 1)} disabled={index === images.length - 1} aria-label={t("moveRight")} className={`${ICON_BUTTON} right-1 bottom-1`}>
              <ChevronRight aria-hidden size={16} />
            </button>
            <button type="button" onClick={() => remove(image)} aria-label={t("removeImage")} className={`${ICON_BUTTON} top-1 right-1`}>
              <X aria-hidden size={16} />
            </button>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <button
            type="button"
            name="images"
            onClick={() => input.current?.click()}
            aria-label={t("addImage")}
            className="grid aspect-[4/3] place-items-center rounded-[6px] border border-dashed border-deco/40 text-primary hover:border-primary md:aspect-video"
          >
            <Plus aria-hidden size={22} />
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        multiple
        hidden
        onChange={(event) => void pick(event.target.files)}
      />
      <p id={noteId} className={`text-meta ${error ? "text-danger" : "text-mute"}`}>
        {error ?? t("imagesHelp")}
      </p>
    </div>
  );
}
