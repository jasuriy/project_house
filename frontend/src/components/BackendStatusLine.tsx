import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { fetchBackendStatus } from "@/lib/backend";

/**
 * Async server component: opts into per-request rendering so API_URL is read
 * at runtime (not baked in at build) and the status is never cached.
 */
export async function BackendStatusLine() {
  await connection();
  const status = await fetchBackendStatus(
    process.env.API_URL ?? "http://localhost:8000",
  );
  const t = await getTranslations("Status");

  return <strong data-status={status}>{t(status)}</strong>;
}
