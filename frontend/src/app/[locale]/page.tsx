import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { FieldFilters } from "@/components/projects/FieldFilters";
import { LoadMore } from "@/components/projects/LoadMore";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { apiGet } from "@/lib/api";
import { type FeedPage, type FieldName, isFieldName } from "@/lib/types";

/** The feed: newest projects first, filtered by field (mockup screen 1, "Lenta"). */
export default async function FeedPageRoute({
  params,
  searchParams,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations("Feed");
  const te = await getTranslations("Errors");

  const raw = (await searchParams).field;
  const field: FieldName | null = typeof raw === "string" && isFieldName(raw) ? raw : null;
  const query = new URLSearchParams({ limit: "24" });
  if (field) query.set("field", field);
  const feed = await apiGet<FeedPage>(`/api/v1/projects?${query}`);

  return (
    <>
      <h1 className="text-h2 font-bold tracking-[-0.015em] text-fg">{t("title")}</h1>
      <p className="mt-1 text-ui text-mute">{t("sub")}</p>
      <FieldFilters active={field} />

      {!feed.ok ? (
        <div role="alert" className="rounded-media border border-border bg-card px-4 py-6 text-center">
          <p className="text-body text-fg">
            {feed.code === "unreachable" ? te("unreachable") : te("server")}
          </p>
          <Link
            href={field ? { pathname: "/", query: { field } } : "/"}
            className="mt-3 inline-flex min-h-11 items-center rounded-control px-2 text-ui font-semibold text-primary md:min-h-0"
          >
            {te("retry")}
          </Link>
        </div>
      ) : feed.data.items.length === 0 ? (
        <p className="rounded-media border border-border bg-card px-4 py-6 text-center text-body text-mute">
          {t("empty")}
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5 2xl:gap-6">
          {feed.data.items.map((card) => (
            <ProjectCard key={card.path} card={card} />
          ))}
          <LoadMore initialCursor={feed.data.next_cursor} field={field} />
        </div>
      )}
    </>
  );
}
