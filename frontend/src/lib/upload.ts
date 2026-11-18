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
