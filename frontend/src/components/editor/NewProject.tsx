"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { TextField } from "@/components/auth/TextField";
import { Link } from "@/i18n/navigation";
import { clientPost } from "@/lib/client-api";
import { projectErrorKey } from "@/lib/project-errors";
import type { ImportPreview } from "@/lib/types";
import { ProjectForm } from "./ProjectForm";

const LINK_BUTTON = "inline-flex min-h-11 items-center text-small font-semibold text-primary hover:underline md:min-h-0";
const PRIMARY =
  "inline-flex h-11 items-center justify-center rounded-control bg-primary px-4 text-ui font-semibold text-on-primary hover:opacity-90 disabled:opacity-60 md:h-10";

/** The step bar (mockup screens 4a / 4): 1 GitHub havolasi, 2 Ma'lumotlar va demo. */
function Steps({ current }: { current: 1 | 2 }) {
  const t = useTranslations("Editor");
  const step = (n: 1 | 2, label: string) => (
    <span className={`inline-flex items-center gap-2 ${current === n ? "font-semibold text-fg" : "text-mute"}`}>
      <b
        className={`grid size-5.5 place-items-center rounded-full text-caption ${
          current === n ? "bg-primary text-on-primary" : n < current ? "bg-ok text-on-primary" : "bg-muted text-fg"
        }`}
      >
        {n}
      </b>
      {label}
    </span>
  );
  return (
    <p className="flex flex-wrap items-center gap-2 text-small">
      {step(1, t("step1"))}
      <i aria-hidden className="block h-px w-7 bg-border" />
      {step(2, t("step2"))}
    </p>
  );
}

/**
 * Loyiha qo'shish: step 1 reads the user's own repository from GitHub (mockup screen 4a), step 2
 * is the form, pre-filled. Without GitHub, "fill in by hand" goes straight to the form.
 */
export function NewProject({
  author,
  username,
  githubConnected,
}: {
  author: string;
  username: string;
  githubConnected: boolean;
}) {
  const t = useTranslations("Editor");
  const te = useTranslations("EditorErrors");
  const [prefill, setPrefill] = useState<ImportPreview | null>(null);
  const [manual, setManual] = useState(false);
  const [link, setLink] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function importRepo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await clientPost<ImportPreview>("/api/v1/me/projects/import", { github_url: link });
    setPending(false);
    if (result.ok) setPrefill(result.data);
    else setError(te(projectErrorKey(result.status === 0 ? "unreachable" : result.code)));
  }

  if (prefill || manual) {
    return (
      <div className="grid gap-5">
        <Steps current={2} />
        <ProjectForm
          key={prefill?.github_url ?? "manual"}
          author={author}
          username={username}
          prefill={prefill ?? undefined}
          onOtherRepo={() => {
            setPrefill(null);
            setManual(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <Steps current={1} />
      <div className="grid max-w-[640px] gap-4.5 rounded-card border border-border bg-card p-5 md:p-5.5">
        {githubConnected ? (
          <form onSubmit={importRepo} noValidate className="grid gap-4.5">
            <TextField
              name="github_url"
              label={t("linkLabel")}
              required
              help={t("linkHelp")}
              placeholder="github.com/username/repository"
              defaultValue={link}
              maxLength={300}
              onChange={setLink}
              error={error ?? undefined}
            />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <button type="submit" disabled={pending || !link.trim()} className={PRIMARY}>
                {pending ? t("checking") : t("continue")}
              </button>
              <button type="button" onClick={() => setManual(true)} className={LINK_BUTTON}>
                {t("manual")}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid gap-2.5 rounded-[10px] bg-accent-soft px-4 py-3.5 text-small text-fg">
              <b className="text-ui">{t("connectTitle")}</b>
              <span>{t("connectText")}</span>
              <span>
                <Link href="/settings" className={PRIMARY}>
                  {t("connectButton")}
                </Link>
              </span>
            </div>
            <button type="button" onClick={() => setManual(true)} className={`${LINK_BUTTON} justify-self-start`}>
              {t("manual")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
