"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Link } from "@/i18n/navigation";
import { clientDelete, clientGet, clientPost } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import { socialErrorKey } from "@/lib/social-errors";
import type { Comment, CommentPage } from "@/lib/types";
import { ReportDialog } from "./ReportDialog";

const MAX_BODY = 1000;

const SMALL_BUTTON = "inline-flex h-11 items-center justify-center rounded-control px-3 text-small font-semibold md:h-8";
const ACTION = "inline-flex min-h-11 items-center rounded-control text-meta hover:underline md:min-h-0";

/**
 * Izohlar (mockup screen 2b): oldest first, a write box with a counter, Oʻchirish for the author
 * and the project's owner (asks once, in place), Shikoyat qilish on other people's comments.
 * `initial` is the first page loaded with the page; null when that load failed.
 */
export function Comments({
  projectId,
  initial,
  count,
  viewer,
  loginHref,
}: {
  projectId: number;
  initial: CommentPage | null;
  count: number;
  viewer: string | null;
  loginHref: string | null;
}) {
  const t = useTranslations("Social");
  const te = useTranslations("SocialErrors");
  const locale = useLocale();
  const bodyId = useId();
  const [items, setItems] = useState<Comment[]>(initial?.items ?? []);
  const [cursor, setCursor] = useState(initial?.next_cursor ?? null);
  const [total, setTotal] = useState(count);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const path = `/api/v1/projects/${projectId}/comments`;
  const trimmed = body.trim();

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !trimmed) return;
    setBusy(true);
    setError(null);
    const result = await clientPost<Comment>(path, { body });
    setBusy(false);
    if (!result.ok) return setError(te(socialErrorKey(result.code)));
    setItems((list) => [...list, result.data]);
    setTotal((n) => n + 1);
    setBody("");
  }

  async function remove(id: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await clientDelete(`/api/v1/me/comments/${id}`);
    setBusy(false);
    setAsking(null);
    // Already gone counts as done: the list catches up with the server.
    if (!result.ok && result.code !== "comment_not_found") {
      return setError(te(socialErrorKey(result.code)));
    }
    setItems((list) => list.filter((c) => c.id !== id));
    setTotal((n) => Math.max(0, n - 1));
  }

  async function more() {
    if (busy || cursor === null) return;
    setBusy(true);
    const result = await clientGet<CommentPage>(`${path}?cursor=${encodeURIComponent(cursor)}`);
    setBusy(false);
    if (!result.ok) return setError(te(socialErrorKey(result.code)));
    setItems((list) => {
      const seen = new Set(list.map((c) => c.id));
      return [...list, ...result.data.items.filter((c) => !seen.has(c.id))];
    });
    setCursor(result.data.next_cursor);
  }

  return (
    <section aria-labelledby={`${bodyId}-title`} className="grid gap-3.5">
      <h2 id={`${bodyId}-title`} className="text-h3 font-semibold text-fg">
        {t("comments")} <span className="font-medium text-mute tabular-nums">{total}</span>
      </h2>

      {loginHref !== null ? (
        <p className="rounded-media border border-dashed border-border px-3.5 py-3.5 text-ui text-mute">
          {t.rich("signIn", {
            link: (chunks) => (
              <Link href={loginHref} className="font-semibold text-primary hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      ) : (
        <form onSubmit={send} className="grid gap-2">
          <label htmlFor={bodyId} className="sr-only">
            {t("commentLabel")}
          </label>
          <textarea
            id={bodyId}
            value={body}
            maxLength={MAX_BODY}
            rows={3}
            placeholder={t("commentPlaceholder")}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-[76px] rounded-control border border-border bg-card px-3 py-2.5 text-ui text-fg placeholder:text-mute"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-meta text-mute tabular-nums" aria-hidden>
              {body.length} / {MAX_BODY}
            </span>
            <button
              type="submit"
              disabled={busy || !trimmed}
              className={`${SMALL_BUTTON} bg-primary text-on-primary hover:opacity-90 disabled:opacity-60`}
            >
              {t("send")}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
      {initial === null && <p className="text-small text-mute">{t("loadFailed")}</p>}
      {initial !== null && items.length === 0 && <p className="text-small text-mute">{t("empty")}</p>}

      {items.length > 0 && (
        <ul className="grid">
          {items.map((comment) => {
            const own = viewer !== null && comment.author.url === `/${viewer}`;
            return (
              <li key={comment.id} className="grid grid-cols-[36px_1fr] gap-2.5 border-t border-border py-3.5">
                <Avatar
                  name={comment.author.name}
                  src={comment.author.avatar_url}
                  className="size-9 border border-border bg-muted text-caption font-semibold text-fg"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 text-small">
                    <Link href={comment.author.url} className="font-semibold text-fg hover:text-primary">
                      {comment.author.name}
                    </Link>
                    <time dateTime={comment.created_at} className="text-meta text-mute">
                      {formatDate(comment.created_at, locale)}
                    </time>
                  </div>
                  <p className="mt-0.5 text-ui break-words whitespace-pre-line text-fg">{comment.body}</p>
                  {asking === comment.id ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-small text-fg">
                      {t("deleteAsk")}
                      <button
                        type="button"
                        onClick={() => remove(comment.id)}
                        disabled={busy}
                        className={`${SMALL_BUTTON} bg-danger text-on-primary hover:opacity-90 disabled:opacity-60`}
                      >
                        {t("deleteYes")}
                      </button>
                      <button
                        type="button"
                        autoFocus
                        onClick={() => setAsking(null)}
                        className={`${SMALL_BUTTON} border border-border bg-card text-fg hover:border-primary`}
                      >
                        {t("deleteNo")}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-0.5 flex gap-3.5">
                      {comment.can_delete && (
                        <button type="button" onClick={() => setAsking(comment.id)} className={`${ACTION} text-danger`}>
                          {t("delete")}
                        </button>
                      )}
                      {!own && (
                        <ReportDialog
                          target={{ comment_id: comment.id }}
                          description={t("reportComment", { name: comment.author.name })}
                          loginHref={loginHref}
                          triggerClassName={`${ACTION} text-mute`}
                        />
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {cursor !== null && (
        <button
          type="button"
          onClick={more}
          disabled={busy}
          className={`${SMALL_BUTTON} justify-self-start border border-border bg-card text-fg hover:border-primary`}
        >
          {t("loadMore")}
        </button>
      )}
    </section>
  );
}
