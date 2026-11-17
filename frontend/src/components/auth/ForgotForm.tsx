"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { authErrorKey } from "@/lib/auth-errors";
import { clientPost } from "@/lib/client-api";
import { Banner } from "./Banner";
import { TextField } from "./TextField";

/** Parolni tiklash (auth mockup screen 5). The same message whether or not the email has an account. */
export function ForgotForm() {
  const t = useTranslations("Forgot");
  const te = useTranslations("AuthErrors");
  const tl = useTranslations("Login");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await clientPost("/api/v1/auth/password/forgot", {
      email: String(form.get("email") ?? ""),
    });
    if (result.ok) setSent(true);
    else setError(te(authErrorKey(result.code)));
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      {sent && <Banner tone="ok">{t("sent")}</Banner>}
      <TextField
        name="email"
        type="email"
        label={t("email")}
        autoComplete="username"
        placeholder={tl("emailPlaceholder")}
        required
        requiredMark={false}
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
        {busy ? t("sending") : sent ? t("again") : t("submit")}
      </button>
    </form>
  );
}
