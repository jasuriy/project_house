import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoadMore } from "@/components/projects/LoadMore";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Link, redirect } from "@/i18n/navigation";
import { getMyList } from "@/lib/projects";
import { getCurrentUser } from "@/lib/session";

export type ListKind = "saved" | "liked";

const KINDS: ListKind[] = ["saved", "liked"];

export async function myListMetadata(locale: string, kind: ListKind): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Mine" });
  // A private page: nothing for search engines.
  return { title: `${t(kind)} - Project House`, robots: { index: false } };
}

/**
 * Saqlanganlar / Yoqtirganlarim (mockup screen 3d): your own list, only after login. The tabs
 * switch between the two lists; the cards and Yana koʻrsatish are the feed's.
 */
export async function MyList({ kind, locale }: { kind: ListKind; locale: string }) {
  const user = await getCurrentUser();
  if (!user) return redirect({ href: `/login?next=/${kind}`, locale });
  const [list, t, te] = await Promise.all([
    getMyList(kind),
    getTranslations("Mine"),
    getTranslations("Errors"),
  ]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-h2 font-bold tracking-[-0.015em] text-fg">{t(kind)}</h1>
        <p className="mt-1 text-small text-mute">
          {t("only")} {t(kind === "saved" ? "savedOrder" : "likedOrder")}
        </p>
      </div>

      <nav aria-label={t("lists")} className="flex gap-6 border-b border-border">
        {KINDS.map((other) => (
          <Link
            key={other}
            href={`/${other}`}
            aria-current={other === kind ? "page" : undefined}
            className={`inline-flex min-h-11 items-center text-ui ${
              other === kind
                ? "font-semibold text-fg shadow-[inset_0_-2px_0_var(--color-primary)]"
                : "text-mute hover:text-fg"
            }`}
          >
            {t(other)}
          </Link>
        ))}
      </nav>

      {!list.ok ? (
        <p role="alert" className="rounded-media border border-border bg-card px-4 py-6 text-center text-body text-fg">
          {list.code === "unreachable" ? te("unreachable") : te("server")}
        </p>
      ) : list.data.items.length === 0 ? (
        <div className="grid justify-items-center gap-2.5 rounded-card border border-dashed border-border px-5 py-7 text-center">
          <p className="text-lead font-semibold text-fg">{t(kind === "saved" ? "savedEmptyTitle" : "likedEmptyTitle")}</p>
          <p className="text-ui text-mute">{t(kind === "saved" ? "savedEmptyText" : "likedEmptyText")}</p>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-control border border-border bg-card px-4 text-ui font-semibold text-fg hover:border-primary md:h-10"
          >
            {t("toFeed")}
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.data.items.map((card) => (
            <ProjectCard key={card.path} card={card} />
          ))}
          <LoadMore initialCursor={list.data.next_cursor} endpoint={`/api/v1/me/${kind}`} />
        </div>
      )}
    </div>
  );
}
