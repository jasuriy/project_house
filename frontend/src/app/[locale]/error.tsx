"use client";

import { useTranslations } from "next-intl";

/**
 * Anything that throws while rendering a page: the same error box as the feed and project pages.
 * retry() fetches the page again (reset() would only re-render the cached, failed result).
 */
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("Errors");
  return (
    <div role="alert" className="rounded-media border border-border bg-card px-4 py-6 text-center">
      <p className="text-body text-fg">{t("server")}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-3 inline-flex min-h-11 items-center rounded-control px-2 text-ui font-semibold text-primary md:min-h-0"
      >
        {t("retry")}
      </button>
    </div>
  );
}
