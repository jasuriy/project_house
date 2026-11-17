"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Link } from "@/i18n/navigation";
import { authErrorKey } from "@/lib/auth-errors";
import { clientPost } from "@/lib/client-api";
import { Banner } from "./Banner";
import { TextField } from "./TextField";
import { forgetToken, useLinkToken } from "./takeToken";

const KEY = "ph_reset_token";
type State = "form" | "done" | "expired";

const PRIMARY =
  "inline-flex h-11 w-full items-center justify-center rounded-control bg-primary text-ui font-semibold text-on-primary hover:opacity-90 disabled:opacity-60";

/** Yangi parol (auth mockup screen 6): form, success (all sessions ended), expired link. */
export function ResetForm({ token: fromUrl, footer }: { token: string | null; footer: React.ReactNode }) {
  const t = useTranslations("Reset");
  const te = useTranslations("AuthErrors");
  const tl = useTranslations("Login");
  const token = useLinkToken(KEY, fromUrl);
  const [result, setResult] = useState<State>("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // No token in the link or in storage: nothing to reset with, same screen as an expired link.
  const state: State = token === null && result === "form" ? "expired" : result;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !token) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await clientPost("/api/v1/auth/password/reset", {
      token,
      new_password: String(form.get("new_password") ?? ""),
    });
    if (result.ok) {
      forgetToken(KEY);
      setResult("done");
    } else if (result.code === "token_invalid") {
      forgetToken(KEY);
      setResult("expired");
    } else {
      setError(te(authErrorKey(result.code)));
    }
    setBusy(false);
  }

  if (state === "done") {
    return (
      <Section title={t("doneTitle")}>
        <Banner tone="ok">{t("done")}</Banner>
        <Link href="/login" className={PRIMARY}>
          {t("login")}
        </Link>
      </Section>
    );
  }
  if (state === "expired") {
    return (
      <Section title={t("expiredTitle")}>
        <Banner tone="warn">{t("expired")}</Banner>
        <Link href="/forgot-password" className={PRIMARY}>
          {t("newLink")}
        </Link>
        {footer}
      </Section>
    );
  }
  return (
    <Section title={t("title")} sub={t("sub")}>
      <form onSubmit={submit} className="grid gap-5">
        <TextField
          name="new_password"
          type="password"
          label={t("password")}
          autoComplete="new-password"
          required
          requiredMark={false}
          help={t("help")}
          error={error ?? undefined}
          toggleLabels={{ show: tl("showPassword"), hide: tl("hidePassword") }}
        />
        <button type="submit" disabled={busy || token === undefined} className={PRIMARY}>
          {busy ? t("saving") : t("submit")}
        </button>
      </form>
      {footer}
    </Section>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <>
      <div>
        <h1 className="text-h2 font-bold tracking-[-0.015em] text-fg">{title}</h1>
        {sub && <p className="mt-1 text-ui text-mute">{sub}</p>}
      </div>
      {children}
    </>
  );
}
