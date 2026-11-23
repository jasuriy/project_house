"use client";

import { CirclePlay, Folder, LoaderCircle, Play, RotateCw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/icons";
import { ApiError, type Catalog, api } from "@/lib/api";
import { formatDuration, formatSize, putWithProgress, readVideo } from "@/lib/upload";
import type { ProjectDraft } from "@/lib/use-project-draft";

type Job = { fileName: string; size: number; phase: "preparing" | "uploading" | "finishing"; progress: number };

/** Choosing, uploading (browser -> R2 directly) and previewing the demo video. */
export function VideoCard({ draft, catalog, error: requiredError }: { draft: ProjectDraft; catalog: Catalog; error: string | null }) {
  const video = draft.project?.video ?? null;
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    const rules = catalog.upload_rules.video;
    if (!rules.content_types.includes(file.type)) return setError("Use an MP4 or WebM video.");
    if (file.size > rules.max_bytes) return setError(`The video must be at most ${formatSize(rules.max_bytes)}.`);

    setJob({ fileName: file.name, size: file.size, phase: "preparing", progress: 0 });
    try {
      const { duration, poster } = await readVideo(file);
      const id = await draft.ensureDraft();
      // 1. ask for a signed link, 2. upload straight to R2, 3. tell the backend it is there
      const ticket = await draft.enqueue(() => api.uploadUrl(id, "video", { content_type: file.type, size: file.size }));
      setJob((j) => j && { ...j, phase: "uploading" });
      await putWithProgress(ticket.upload_url, file, ticket.headers, (p) => setJob((j) => j && { ...j, progress: p }));
      setJob((j) => j && { ...j, phase: "finishing", progress: 1 });
      await draft.send((pid) =>
        api.completeUpload(pid, "video", { key: ticket.key, file_name: file.name, duration_seconds: duration }),
      );
      if (poster) await uploadPoster(id, poster);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Upload failed");
    } finally {
      setJob(null);
    }
  }

  // The first frame is a nice-to-have: if it fails, the video is still saved.
  async function uploadPoster(id: string, poster: Blob) {
    try {
      const ticket = await draft.enqueue(() => api.uploadUrl(id, "poster", { content_type: "image/jpeg", size: poster.size }));
      await putWithProgress(ticket.upload_url, poster, ticket.headers, () => undefined);
      await draft.send((pid) => api.completeUpload(pid, "poster", { key: ticket.key }));
    } catch {
      /* keep the video without a still image */
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
        <Preview url={video.url} poster={video.poster_url} duration={video.duration_seconds} />
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
            <p className="truncate text-[12px] font-bold leading-[15px] text-ink">{video.file_name ?? "Video"}</p>
            <p className="text-[11.5px] leading-[15px] text-muted">
              {video.size !== null && formatSize(video.size)}
              {video.duration_seconds !== null && <> &middot; {formatDuration(video.duration_seconds)}</>}
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
 * Signed links change on every answer (new signature), but the file is the same. Keep the first
 * link while the file path is unchanged, so the player does not reload on every autosave.
 */
function useStableLink(link: string | null): string | null {
  const [stable, setStable] = useState(link);
  const path = (l: string | null) => l?.split("?")[0] ?? null;
  if (path(stable) !== path(link)) setStable(link);
  return path(stable) === path(link) ? stable : link;
}

function Preview(props: { url: string; poster: string | null; duration: number | null }) {
  const url = useStableLink(props.url) ?? props.url;
  const poster = useStableLink(props.poster);
  const { duration } = props;
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="mt-[9px] rounded-[9px] border border-line bg-[#fbf8f7] p-[5px]">
      <div className="relative aspect-video overflow-hidden rounded-[6px] bg-[#1b1a33]">
        <video
          ref={ref}
          src={url}
          poster={poster ?? undefined}
          preload="metadata"
          controls={playing}
          onEnded={() => setPlaying(false)}
          className="h-full w-full object-contain"
        />
        {!playing && (
          <>
            <button
              type="button"
              aria-label="Play preview"
              onClick={() => {
                setPlaying(true);
                void ref.current?.play();
              }}
              className="absolute left-1/2 top-1/2 flex h-[46px] w-[46px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#2b2b33]/85 text-white outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Play size={20} fill="currentColor" strokeWidth={0} className="ml-[3px]" aria-hidden="true" />
            </button>
            {duration !== null && (
              <span className="absolute bottom-[6px] right-[6px] rounded-[6px] bg-[#2b2b33]/90 px-[8px] py-[2px] text-[12px] font-medium text-white">
                {formatDuration(duration)}
              </span>
            )}
          </>
        )}
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
