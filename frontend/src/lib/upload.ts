// Browser-side helpers for the demo video: read it locally, then upload it straight to R2.

const POSTER_MAX_WIDTH = 1280;

/** Reads a chosen video file in the browser: its length and a JPEG of its first frame. */
export function readVideo(file: File): Promise<{ duration: number | null; poster: Blob | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.src = url;

    const finish = (poster: Blob | null) => {
      URL.revokeObjectURL(url);
      // Some WebM files report an infinite length; send "unknown" instead.
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      resolve({ duration, poster });
    };

    video.onerror = () => finish(null);
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.1, video.duration || 0); // a frame just after the start
    };
    video.onseeked = () => {
      const scale = Math.min(1, POSTER_MAX_WIDTH / video.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => finish(blob), "image/jpeg", 0.85);
    };
  });
}

/**
 * Uploads a file to a presigned R2 link. XMLHttpRequest instead of fetch, because only XHR
 * reports upload progress.
 */
export function putWithProgress(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed (network)"));
    xhr.send(body);
  });
}

export function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
