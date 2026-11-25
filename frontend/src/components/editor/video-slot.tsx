"use client";

import { LoaderCircle, Upload } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { ApiError, type Catalog, api } from "@/lib/api";
import { formatSize, putWithProgress, readVideo } from "@/lib/upload";
import type { ProjectFormState } from "@/lib/use-project-form";
import { FieldError } from "./shared";

type Job = { fileName: string; size: number; phase: "preparing" | "uploading" | "finishing"; progress: number };

const frame = "relative aspect-video w-full overflow-hidden rounded-[16px]";

/**
 * The demo video in the project page's video frame: a dashed slot while empty, progress while
 * uploading, then the person's own file with the browser's controls. The file goes from the
 * browser straight to R2's temporary folder; the server only signs the link. Nothing is saved
 * until Render.
 */
export function VideoSlot({ state, catalog, error: requiredError }: { state: ProjectFormState; catalog: Catalog; error: string | null }) {
  const { video } = state;
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // False once the page is left: an upload that finishes later must not fill the emptied form.
  const visibleRef = useRef(true);

  useLayoutEffect(() => {
    visibleRef.current = true;
    return () => {
      visibleRef.current = false;
      setJob(null);
      setError(null);
    };
  }, []);

  async function upload(file: File) {
    setError(null);
    const rules = catalog.upload_rules.video;
    if (!rules.content_types.includes(file.type)) return setError("Use an MP4 or WebM video.");
    if (file.size > rules.max_bytes) return setError(`The video must be at most ${formatSize(rules.max_bytes)}.`);

    setJob({ fileName: file.name, size: file.size, phase: "preparing", progress: 0 });
    try {
      const { duration, poster } = await readVideo(file);
      // 1. ask for a signed link, 2. upload straight to R2
      const ticket = await api.uploadUrl("video", { content_type: file.type, size: file.size });
      setJob((j) => j && { ...j, phase: "uploading" });
      await putWithProgress(ticket.upload_url, file, ticket.headers, (p) => setJob((j) => j && { ...j, progress: p }));
      setJob((j) => j && { ...j, phase: "finishing", progress: 1 });
      // The video counts as uploaded only after its first frame is done (or failed), so Render
      // never runs between the two and saves the project without its still image.
      const posterKey = poster ? await uploadPoster(poster) : null;
      if (!visibleRef.current) return;
      state.setVideo({
        key: ticket.key,
        posterKey,
        fileName: file.name,
        size: file.size,
        duration,
        previewUrl: URL.createObjectURL(file),
        posterPreviewUrl: poster && posterKey ? URL.createObjectURL(poster) : null,
      });
    } catch (e) {
      if (visibleRef.current) setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Upload failed");
    } finally {
      if (visibleRef.current) setJob(null);
    }
  }

  // The first frame is a nice-to-have: if it fails, the video is kept without it.
  async function uploadPoster(poster: Blob): Promise<string | null> {
    try {
      const ticket = await api.uploadUrl("poster", { content_type: "image/jpeg", size: poster.size });
      await putWithProgress(ticket.upload_url, poster, ticket.headers, () => undefined);
      return ticket.key;
    } catch {
      return null;
    }
  }

  const choose = () => inputRef.current?.click();
  const shownError = error ?? (video ? null : requiredError);
  const maxSize = formatSize(catalog.upload_rules.video.max_bytes).replace(".0", "");

  return (
    <div className="flex flex-col gap-[4px]">
      <input
        ref={inputRef}
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        accept={catalog.upload_rules.video.content_types.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />

      {job ? (
        <Progress job={job} />
      ) : video ? (
        <section
          aria-label="Demo video"
          className={`${frame} border border-line bg-[#17162f] shadow-[0_12px_32px_-16px_rgba(23,22,47,0.28)]`}
        >
          {/* The person's own file from memory (an object URL): nothing is downloaded. */}
          <video
            src={video.previewUrl}
            poster={video.posterPreviewUrl ?? undefined}
            preload="metadata"
            playsInline
            controls
            onEnded={(e) => e.currentTarget.load()}
            className="h-full w-full object-contain"
            aria-label="Demo video preview"
          />
          <button
            type="button"
            onClick={choose}
            className="pick tap absolute right-[12px] top-[12px] inline-flex h-[36px] items-center rounded-[8px] border border-line bg-card px-[12px] text-[13px] font-semibold text-ink"
          >
            Replace video
          </button>
        </section>
      ) : (
        <button
          type="button"
          id="video"
          onClick={choose}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void upload(file);
          }}
          data-invalid={!!shownError || undefined}
          aria-describedby={shownError ? "video-error" : undefined}
          className={`pick ${frame} flex flex-col items-center justify-center gap-[8px] text-center ${
            dragging ? "bg-badge outline outline-1 outline-primary" : "pick-empty bg-card"
          }`}
        >
          <span aria-hidden="true" className="mb-[4px] inline-flex h-[48px] w-[48px] items-center justify-center rounded-full bg-badge text-primary">
            <Upload size={24} strokeWidth={2} />
          </span>
          <span className="text-h font-semibold text-ink">Add your demo video</span>
          <span className="text-cap text-muted [@media(hover:none)]:hidden">Drop an MP4 or WebM here, up to {maxSize}</span>
          <span className="hidden text-cap text-muted [@media(hover:none)]:inline">MP4 or WebM, up to {maxSize}</span>
          <span aria-hidden="true" className="mt-[8px] inline-flex h-[36px] items-center rounded-[8px] border border-line bg-card px-[12px] text-[13px] font-semibold text-ink">
            Choose video
          </span>
        </button>
      )}
      <FieldError id="video" message={shownError} />
    </div>
  );
}

function Progress({ job }: { job: Job }) {
  const percent = Math.round(job.progress * 100);
  const label = job.phase === "preparing" ? "Preparing..." : job.phase === "finishing" ? "Finishing..." : `Uploading ${percent}%`;
  return (
    <div className={`${frame} flex flex-col items-center justify-center gap-[12px] border border-line bg-card px-[15%]`}>
      <p className="flex w-full items-center gap-[10px]">
        <LoaderCircle size={18} className="shrink-0 animate-spin text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">{job.fileName}</span>
        <span className="text-cap text-muted">{formatSize(job.size)}</span>
      </p>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Upload progress"
        className="h-[6px] w-full overflow-hidden rounded-full bg-track"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <span className="self-start text-cap text-muted">{label}</span>
    </div>
  );
}
