"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { clientGet } from "@/lib/client-api";
import type { FeedPage, FieldName, ProjectCard as Card } from "@/lib/types";
import { ProjectCard } from "./ProjectCard";

/** Appends the next feed pages; keeps the field filter on every request (plan C2 Step 2). */
export function LoadMore({
  initialCursor,
  field,
}: {
  initialCursor: string | null;
  field: FieldName | null;
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
    const query = new URLSearchParams({ limit: "24", cursor });
    if (field) query.set("field", field);
    const result = await clientGet<FeedPage>(`/api/v1/projects?${query}`);
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
