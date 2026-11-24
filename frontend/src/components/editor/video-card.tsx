"use client";

import { CirclePlay, Folder, LoaderCircle, RotateCw, Upload } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/icons";
import { ApiError, type Catalog, api } from "@/lib/api";
import { formatDuration, formatSize, putWithProgress, readVideo } from "@/lib/upload";
import type { ProjectFormState } from "@/lib/use-project-form";

type Job = { fileName: string; size: number; phase: "preparing" | "uploading" | "finishing"; progress: number };

/**
 * Choosing, uploading and previewing the demo video. The file goes from the browser straight to
 * R2's temporary folder; the server only signs the link. Nothing is saved until Render.
 */
export function VideoCard({ state, catalog, error: requiredError }: { state: ProjectFormState; catalog: Catalog; error: string | null }) {
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

  return (
    <Card icon={<CirclePlay size={20} strokeWidth={1.7} />} title="Demo video" subtitle="Upload a demo video that shows your project in action.">
      <input
        ref={inputRef}
        type="file"
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
        <Preview url={video.previewUrl} poster={video.posterPreviewUrl} />
      ) : (
        <button
          type="button"
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
          className={`mt-[10px] flex aspect-video w-full flex-col items-center justify-center gap-[6px] rounded-[8px] border-[1.5px] border-dashed text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 ${
            dragging ? "border-primary bg-primary-tint" : shownError ? "border-danger" : "border-field-line bg-field hover:border-primary"
          }`}
        >
          <Upload size={22} strokeWidth={1.7} className="text-primary" aria-hidden="true" />
          <span className="text-[13.5px] font-semibold text-ink-2">Drop a video here or choose a file</span>
          <span className="text-[12.5px] text-muted">
            MP4 or WebM, up to {formatSize(catalog.upload_rules.video.max_bytes).replace(".0", "")}
          </span>
        </button>
      )}

      {video && !job && (
        <div className="mt-[5px] flex flex-wrap items-center gap-x-[12px] gap-y-[6px]">
          <span className="flex h-[33px] w-[33px] items-center justify-center rounded-[7px] border border-line bg-[#fffdfc]">
            <Folder size={18} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-bold leading-[15px] text-ink">{video.fileName}</p>
            <p className="text-[11.5px] leading-[15px] text-muted">
              {formatSize(video.size)}
              {video.duration !== null && <> &middot; {formatDuration(video.duration)}</>}
            </p>
          </div>
          <span className="flex items-center gap-[6px] text-[12px] font-semibold text-success">
            <StatusDot done size={15} />
            Upload complete
          </span>
          <button
            type="button"
            onClick={choose}
            className="flex items-center gap-[6px] rounded-[5px] text-[12px] font-semibold text-primary max-sm:min-h-[44px] max-sm:text-[14px] sm:ml-[16px] outline-none hover:text-primary-strong focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <RotateCw size={14} strokeWidth={2} aria-hidden="true" />
            Replace
          </button>
        </div>
      )}

      {shownError && (
        <p role="alert" className="mt-[6px] text-[12px] text-danger">
          {shownError}
        </p>
      )}
    </Card>
  );
}

/**
 * Plays the person's own file from memory (an object URL), so nothing is downloaded. The browser's
 * own controls from the start, the same as on the project page; the length is shown once, below.
 */
function Preview({ url, poster }: { url: string; poster: string | null }) {
  return (
    <div className="mt-[9px] rounded-[9px] border border-line bg-[#fbf8f7] p-[5px]">
      <div className="aspect-video overflow-hidden rounded-[6px] bg-[#1b1a33]">
        <video
          src={url}
          poster={poster ?? undefined}
          preload="metadata"
          playsInline
          controls
          onEnded={(e) => e.currentTarget.load()}
          className="h-full w-full object-contain"
          aria-label="Demo video preview"
        />
      </div>
    </div>
  );
}

function Progress({ job }: { job: Job }) {
  const percent = Math.round(job.progress * 100);
  const label = job.phase === "preparing" ? "Preparing..." : job.phase === "finishing" ? "Finishing..." : `Uploading ${percent}%`;
  return (
    <div className="mt-[10px] flex aspect-video flex-col justify-center gap-[10px] rounded-[8px] border border-line bg-field px-[20px]">
      <div className="flex items-center gap-[10px]">
        <LoaderCircle size={18} className="animate-spin text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-2">{job.fileName}</span>
        <span className="text-[12.5px] text-muted">{formatSize(job.size)}</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Upload progress"
        className="h-[6px] overflow-hidden rounded-full bg-primary-tint"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[12.5px] text-muted">{label}</span>
    </div>
  );
}
