"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { clientGet } from "@/lib/client-api";
import type { FeedPage, ProjectCard as Card } from "@/lib/types";
import { ProjectCard } from "./ProjectCard";

/**
 * Appends the next pages of a card list. `endpoint` is the list's API path with its fixed query
 * (the feed's field filter, kept on every request), limit and cursor are added here.
 */
export function LoadMore({
  initialCursor,
  endpoint,
}: {
  initialCursor: string | null;
  endpoint: string;
}) {
  const t = useTranslations("Feed");
  const te = useTranslations("Errors");
  const [cards, setCards] = useState<Card[]>([]);
  const [cursor, setCursor] = useState(initialCursor);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function load() {
    if (!cursor || busy) return;
    setBusy(true);
    setFailed(false);
    const url = new URL(endpoint, "http://x");
    url.searchParams.set("limit", "24");
    url.searchParams.set("cursor", cursor);
    const result = await clientGet<FeedPage>(`${url.pathname}${url.search}`);
    if (result.ok) {
      setCards((previous) => [...previous, ...result.data.items]);
      setCursor(result.data.next_cursor);
    } else {
      setFailed(true);
    }
    setBusy(false);
  }

  return (
    <>
      {cards.map((card) => (
        <ProjectCard key={card.path} card={card} />
      ))}
      {cursor && (
        <div className="col-span-full mt-2 flex flex-col items-center gap-2">
          {failed && (
            <p role="alert" className="text-small text-danger">
              {te("unreachable")}
            </p>
          )}
          <button
            type="button"
            onClick={load}
            disabled={busy}
            className="inline-flex h-11 items-center rounded-control border border-border bg-card px-4 text-ui font-semibold text-fg hover:border-primary disabled:opacity-60 md:h-10"
          >
            {busy ? t("loading") : failed ? te("retry") : t("loadMore")}
          </button>
        </div>
      )}
    </>
  );
}
