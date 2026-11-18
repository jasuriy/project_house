"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { clientPost } from "@/lib/client-api";
import { socialErrorKey } from "@/lib/social-errors";
import { REPORT_REASONS, type ReportReason } from "@/lib/types";

const MAX_NOTE = 500;

const BUTTON = "inline-flex h-11 items-center justify-center rounded-control px-4 text-ui font-semibold md:h-10";

/**
 * Shikoyat qilish (mockup screen 2c): one of four reasons and an optional note. The browser's
 * <dialog> gives the dimmed backdrop, Esc to close and focus kept inside. Logged out, the trigger
 * is a link to login that comes back to this page.
 */
export function ReportDialog({
  target,
  description,
  loginHref,
  triggerClassName,
}: {
  target: { project_id: number } | { comment_id: number };
  description: string;
  loginHref: string | null;
  triggerClassName: string;
}) {
  const t = useTranslations("Social");
  const te = useTranslations("SocialErrors");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const noteId = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loginHref !== null) {
    return (
      <Link href={loginHref} className={triggerClassName}>
        {t("report")}
      </Link>
    );
  }

  function open() {
    setReason(null);
    setNote("");
    setSent(false);
    setError(null);
    dialog.current?.showModal();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || reason === null) return;
    setPending(true);
    setError(null);
    const result = await clientPost("/api/v1/me/reports", {
      ...target,
      reason,
      note: note.trim() || null,
    });
    setPending(false);
    if (result.ok) setSent(true);
    else setError(te(socialErrorKey(result.code)));
  }

  const close = () => dialog.current?.close();

  return (
    <>
      <button type="button" onClick={open} className={triggerClassName}>
        {t("report")}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-[460px] rounded-card bg-card p-5 text-fg shadow-xl backdrop:bg-fg/35 md:p-6"
      >
        <h2 id={titleId} className="text-h3 font-semibold">
          {t("report")}
        </h2>
        {sent ? (
          <div className="mt-3 grid gap-4">
            <p role="status" className="text-ui text-fg">
              {t("sent")}
            </p>
            <button type="button" autoFocus onClick={close} className={`${BUTTON} justify-self-end bg-primary text-on-primary hover:opacity-90`}>
              {t("close")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-3 grid gap-3">
            <p className="text-ui text-mute">{description}</p>
            <fieldset className="grid gap-2">
              <legend className="sr-only">{t("reason")}</legend>
              {REPORT_REASONS.map((value) => (
                <label
                  key={value}
                  className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-control border px-3 py-2 text-ui has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                    reason === value ? "border-primary bg-accent-soft" : "border-border hover:border-primary"
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="size-4 accent-primary"
                  />
                  {t(`reasons.${value}`)}
                </label>
              ))}
            </fieldset>
            <div className="grid gap-1.5">
              <label htmlFor={noteId} className="text-small font-semibold">
                {t("note")} <span className="font-normal text-mute">{t("optional")}</span>
              </label>
              <textarea
                id={noteId}
                value={note}
                maxLength={MAX_NOTE}
                rows={3}
                onChange={(event) => setNote(event.target.value)}
                className="rounded-control border border-border bg-card px-3 py-2.5 text-ui text-fg"
              />
              <span className="text-meta text-mute tabular-nums" aria-hidden>
                {note.length} / {MAX_NOTE}
              </span>
            </div>
            {error && (
              <p role="alert" className="text-small text-danger">
                {error}
              </p>
            )}
            <div className="mt-1.5 grid gap-2 md:flex md:flex-row-reverse md:justify-start">
              <button
                type="submit"
                disabled={pending || reason === null}
                className={`${BUTTON} bg-primary text-on-primary hover:opacity-90 disabled:opacity-60`}
              >
                {pending ? t("sending") : t("submit")}
              </button>
              <button
                type="button"
                autoFocus
                onClick={close}
                disabled={pending}
                className={`${BUTTON} border border-border bg-card text-fg hover:border-primary`}
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
