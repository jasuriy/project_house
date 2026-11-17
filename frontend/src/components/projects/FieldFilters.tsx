import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FIELD_NAMES, type FieldName } from "@/lib/types";

/** The field pills above the feed (mockup `.filters`); the active one is primary. */
export function FieldFilters({ active }: { active: FieldName | null }) {
  const t = useTranslations("Fields");
  const tf = useTranslations("Feed");
  const items: { key: FieldName | null; label: string }[] = [
    { key: null, label: t("all") },
    ...FIELD_NAMES.map((field) => ({ key: field, label: t(field) })),
  ];

  return (
    <nav aria-label={tf("filters")} className="mt-4.5 mb-5.5 flex items-center gap-2">
      <ul className="flex flex-wrap gap-2">
        {items.map(({ key, label }) => {
          const on = key === active;
          return (
            <li key={key ?? "all"}>
              <Link
                href={key ? { pathname: "/", query: { field: key } } : "/"}
                aria-current={on ? "page" : undefined}
                className={
                  on
                    ? "inline-flex min-h-11 items-center rounded-full border border-primary bg-primary px-3 text-small text-on-primary md:min-h-0 md:py-1.5"
                    : "inline-flex min-h-11 items-center rounded-full border border-border bg-card px-3 text-small text-fg hover:border-primary md:min-h-0 md:py-1.5"
                }
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <span className="ml-auto hidden flex-none rounded-control border border-border bg-card px-3 py-1.5 text-small text-mute lg:inline-block">
        {tf("sort")}
      </span>
    </nav>
  );
}
