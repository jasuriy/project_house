"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { searchParamsToQuery } from "@/lib/query";

const NAMES: Record<string, string> = {
  uz: "Oʻzbekcha",
  ru: "Русский",
  en: "English",
};

/**
 * Switches the interface language and keeps the page and its query string (?field=). The
 * router call also saves the choice in the locale cookie. Uses useSearchParams, so the
 * layout must wrap it in <Suspense>.
 */
export function LanguageSwitcher() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <label className="relative inline-flex min-h-11 items-center">
      <Globe
        aria-hidden
        strokeWidth={2}
        className="pointer-events-none absolute left-2 size-4 text-mute"
      />
      <select
        aria-label={t("language")}
        value={locale}
        onChange={(event) =>
          router.replace(
            { pathname, query: searchParamsToQuery(searchParams) },
            { locale: event.target.value },
          )
        }
        className="h-11 cursor-pointer appearance-none rounded-control border border-border bg-card pr-2 pl-8 text-small text-fg transition-colors hover:bg-muted md:h-10"
      >
        {routing.locales.map((code) => (
          <option key={code} value={code} lang={code} aria-label={NAMES[code]}>
            {code}
          </option>
        ))}
      </select>
    </label>
  );
}
