"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { clientDelete } from "@/lib/client-api";
import { projectErrorKey } from "@/lib/project-errors";

const STYLE = {
  // The edit form's footer (mockup screen 4b): a bordered button in the danger colour.
  button:
    "inline-flex h-11 items-center justify-center rounded-control border border-border bg-card px-4 text-ui font-semibold text-danger hover:border-danger md:h-10",
  // The project page's links row, next to Ulashish.
  link: "inline-flex min-h-11 items-center rounded-control text-small text-danger hover:underline md:min-h-0",
} as const;

/**
 * O'chirish with a confirmation (mockup screen 4c). The browser's <dialog> gives the dimmed
 * backdrop, Esc to close and focus kept inside. After deleting, the owner lands on their profile.
 */
export function DeleteProject({
  slug,
  title,
  username,
  look,
}: {
  slug: string;
  title: string;
  username: string;
  look: keyof typeof STYLE;
}) {
  const t = useTranslations("Editor");
  const te = useTranslations("EditorErrors");
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await clientDelete(`/api/v1/me/projects/${encodeURIComponent(slug)}`);
    if (result.ok) {
      router.push(`/${username}`);
      router.refresh();
      return; // stay disabled while the profile opens
    }
    setPending(false);
    setError(te(projectErrorKey(result.code)));
  }

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={STYLE[look]}>
        {t("delete")}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="delete-project-title"
        className="m-auto w-[calc(100%-2rem)] max-w-[420px] rounded-card bg-card p-5 text-fg shadow-xl backdrop:bg-fg/35 md:p-6"
      >
        <div className="grid gap-3">
          <h2 id="delete-project-title" className="text-h3 font-semibold">
            {t("deleteTitle")}
          </h2>
          <p className="text-ui text-mute">{t("deleteText", { title })}</p>
          {error && (
            <p role="alert" className="text-small text-danger">
              {error}
            </p>
          )}
          <div className="mt-1.5 grid gap-2 md:flex md:flex-row-reverse md:justify-start">
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className="inline-flex h-11 items-center justify-center rounded-control bg-danger px-4 text-ui font-semibold text-on-primary hover:opacity-90 disabled:opacity-60 md:h-10"
            >
              {pending ? t("deleting") : t("deleteConfirm")}
            </button>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              disabled={pending}
              className="inline-flex h-11 items-center justify-center rounded-control border border-border bg-card px-4 text-ui font-semibold text-fg hover:border-primary md:h-10"
            >
              {t("keep")}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
