"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { clientPost } from "@/lib/client-api";

/** Ends the session through the same-origin API, then re-renders the page as a visitor. */
export function LogoutButton() {
  const t = useTranslations("Nav");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    const result = await clientPost("/api/v1/auth/logout");
    if (result.ok) router.refresh();
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="inline-flex min-h-11 items-center rounded-control px-2 text-ui text-mute transition-colors hover:text-fg disabled:opacity-60"
    >
      {t("logout")}
    </button>
  );
}
