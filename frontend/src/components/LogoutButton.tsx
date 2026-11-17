"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { clientPost } from "@/lib/client-api";

/** Ends the session through the same-origin API, then re-renders the page as a visitor. */
export function LogoutButton() {
  const t = useTranslations("Nav");
  const errors = useTranslations("Errors");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setPending(true);
    setError(null);
    const result = await clientPost("/api/v1/auth/logout");
    if (result.ok) router.refresh();
    else setError(result.status === 0 ? errors("unreachable") : errors("server"));
    setPending(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={logout}
        disabled={pending}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-2 text-ui text-mute transition-colors hover:text-fg disabled:opacity-60"
      >
        {t("logout")}
      </button>
      {error && (
        <p
          role="alert"
          className="absolute top-full right-0 z-10 mt-1 w-64 rounded-control border border-border bg-card px-3 py-2 text-meta text-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}
