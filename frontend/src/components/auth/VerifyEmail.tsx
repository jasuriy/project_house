"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { clientPost } from "@/lib/client-api";
import { Banner } from "./Banner";
import { forgetToken, useLinkToken } from "./takeToken";

const KEY = "ph_verify_token";
type Result = "checking" | "ok" | "bad";

const PRIMARY =
  "inline-flex h-11 w-full items-center justify-center rounded-control bg-primary text-ui font-semibold text-on-primary hover:opacity-90";
const SECONDARY =
  "inline-flex h-11 w-full items-center justify-center rounded-control border border-border bg-card text-ui font-semibold text-fg hover:border-primary";

/**
 * Emailni tasdiqlash (auth mockup screen 7). The token works only in the account's own session:
 * not logged in -> the login page (the token waits in sessionStorage and this page retries after).
 */
export function VerifyEmail({
  token: fromUrl,
  loggedIn,
  email,
  alreadyVerified,
}: {
  token: string | null;
  loggedIn: boolean;
  email: string | null;
  /** The logged-in user's email is verified already (reopened page, or a re-render after confirming). */
  alreadyVerified: boolean;
}) {
  const t = useTranslations("Verify");
  const router = useRouter();
  const token = useLinkToken(KEY, fromUrl);
  const [result, setResult] = useState<Result>("checking");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return; // undefined: not rendered yet; null: no link
    started.current = true;
    if (!loggedIn) {
      router.replace("/login?next=/verify-email");
      return;
    }
    void clientPost("/api/v1/auth/email/verify", { token }).then((response) => {
      if (response.ok) {
        forgetToken(KEY);
        setResult("ok");
        // Not router.refresh(): it restores the address Next remembers, token included.
        router.replace("/verify-email");
      } else if (response.status === 401) {
        router.replace("/login?next=/verify-email");
      } else {
        forgetToken(KEY);
        setResult("bad");
      }
    });
  }, [token, loggedIn, router]);

  // No token: a logged-in user whose email is verified sees the confirmed screen (for example after
  // a language switch re-renders the page); anyone else gets the "link not found" message.
  const state =
    token === null && result === "checking" ? (alreadyVerified ? "ok" : "missing") : result;

  if (state === "checking") {
    return <p role="status" className="text-center text-ui text-mute">{t("checking")}</p>;
  }
  if (state === "ok") {
    return (
      <>
        <h1 className="text-h2 font-bold tracking-[-0.015em] text-fg">{t("okTitle")}</h1>
        <Banner tone="ok">{email ? t("ok", { email }) : t("okNoEmail")}</Banner>
        <Link href="/" className={PRIMARY}>
          {t("feed")}
        </Link>
        <Link href="/settings" className={SECONDARY}>
          {t("settings")}
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-h2 font-bold tracking-[-0.015em] text-fg">{t("badTitle")}</h1>
      <Banner tone="warn">{state === "missing" ? t("noToken") : t("bad")}</Banner>
      {!loggedIn && (
        <Link href="/login" className={PRIMARY}>
          {t("login")}
        </Link>
      )}
    </>
  );
}
