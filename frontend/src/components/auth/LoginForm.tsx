"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { authErrorKey } from "@/lib/auth-errors";
import { clientPost } from "@/lib/client-api";
import { safeNextPath } from "@/lib/safe-url";
import { TextField } from "./TextField";

/** Email and password login. One message for every failure, so it never reveals which emails exist. */
export function LoginForm({ next }: { next: string | null }) {
  const t = useTranslations("Login");
  const te = useTranslations("AuthErrors");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await clientPost("/api/v1/auth/login", {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    if (result.ok) {
      router.replace(safeNextPath(next));
      router.refresh();
      return;
    }
    setError(te(authErrorKey(result.code)));
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate={false} className="grid gap-5">
      <TextField
        name="email"
        type="email"
        label={t("email")}
        autoComplete="email"
        placeholder={t("emailPlaceholder")}
        required
        requiredMark={false}
      />
      <TextField
        name="password"
        type="password"
        label={t("password")}
        autoComplete="current-password"
        placeholder={t("passwordPlaceholder")}
        required
        requiredMark={false}
        toggleLabels={{ show: t("showPassword"), hide: t("hidePassword") }}
        labelAside={
          <Link href="/forgot-password" className="-my-3 rounded-control py-3 text-small text-primary hover:underline md:my-0 md:py-0">
            {t("forgot")}
          </Link>
        }
      />
      {error && (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-11 w-full items-center justify-center rounded-control bg-primary text-ui font-semibold text-on-primary hover:opacity-90 disabled:opacity-60"
      >
        {busy ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
