// Browser side: one image per request, the raw bytes as the body (backend app/media/router.py).
import { failureOf, UNREACHABLE, type ApiResult } from "./api-result";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type Uploaded = { id: string; url: string };

/** Never throws. Same-origin, so the browser sends the Origin header the backend checks. */
export async function uploadImage(file: File): Promise<ApiResult<Uploaded>> {
  try {
    const response = await fetch("/api/v1/me/uploads", {
      method: "POST",
      headers: { "content-type": file.type },
      body: file,
    });
    if (!response.ok) return await failureOf(response);
    return { ok: true, data: (await response.json()) as Uploaded };
  } catch {
    return UNREACHABLE;
  }
}

/** Frees an upload that was removed from the form before publishing. Best effort: a failure only
 * means the backend removes it after a day. */
export function discardUpload(id: string): void {
  void fetch(`/api/v1/me/uploads/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
}

/** PUT the profile photo (raw bytes); the backend crops it to a square. Never throws. */
export async function uploadAvatar(file: File): Promise<ApiResult<{ avatar_url: string }>> {
  try {
    const response = await fetch("/api/v1/me/avatar", {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
    if (!response.ok) return await failureOf(response);
    return { ok: true, data: (await response.json()) as { avatar_url: string } };
  } catch {
    return UNREACHABLE;
  }
}
