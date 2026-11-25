"use client";

import { CirclePlay, CloudUpload, LoaderCircle, TriangleAlert } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { ApiError, type Catalog, api } from "@/lib/api";
import { formatSize, putWithProgress, readVideo } from "@/lib/upload";
import type { ProjectFormState } from "@/lib/use-project-form";
import { FormSection } from "@/components/ui/form";

type Job = { fileName: string; size: number; phase: "preparing" | "uploading" | "finishing"; progress: number };

const frame = "relative aspect-video w-full overflow-hidden rounded-[12px]";

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

  const missing = !!requiredError && !video && !error;
  return (
    <FormSection
      id="video-title"
      icon={CirclePlay}
      title="Demo video"
      aside={
        missing ? (
          <span id="video-error" className="inline-flex items-center gap-[4px] text-cap text-danger">
            <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" />
            Missing
          </span>
        ) : null
      }
    >
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
        <div className={`${frame} border border-line bg-[#17162f]`}>
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
            className="tap absolute right-[12px] top-[12px] inline-flex h-[36px] items-center rounded-[10px] border border-line bg-card px-[12px] text-[13px] font-semibold text-ink outline-none hover:bg-page focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,0.4)]"
          >
            Replace video
          </button>
        </div>
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
          aria-describedby={error ? "video-message" : missing ? "video-error" : undefined}
          className={`${frame} flex flex-col items-center justify-center gap-[8px] border-2 border-dashed text-center outline-none transition-colors focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,0.16)] ${
            dragging
              ? "border-primary bg-badge/40"
              : shownError
                ? "border-danger bg-card"
                : "border-[#c9c5f5] bg-card hover:border-primary hover:bg-page"
          }`}
        >
          <span aria-hidden="true" className="mb-[6px] inline-flex h-[64px] w-[64px] items-center justify-center rounded-full bg-badge text-primary">
            <CloudUpload size={28} strokeWidth={2} />
          </span>
          <span className="text-h font-semibold text-ink">Select a video to upload</span>
          <span className="text-cap text-muted [@media(hover:none)]:hidden">or drop it here. MP4 or WebM, up to {maxSize}</span>
          <span className="hidden text-cap text-muted [@media(hover:none)]:inline">MP4 or WebM, up to {maxSize}</span>
          <span aria-hidden="true" className="mt-[10px] inline-flex h-[40px] items-center rounded-[10px] bg-primary px-[16px] text-[13px] font-semibold text-white">
            Choose video
          </span>
        </button>
      )}
      {error && (
        <p id="video-message" role="status" className="text-cap text-danger">
          {error}
        </p>
      )}
    </FormSection>
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
