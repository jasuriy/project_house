import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackendStatusLine } from "@/components/BackendStatusLine";
import { routing } from "@/i18n/routing";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const t = await getTranslations("Home");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        {t("subtitle")}
      </p>
      <p>
        {t("backendStatus")}{" "}
        <Suspense fallback={<span aria-hidden>...</span>}>
          <BackendStatusLine />
        </Suspense>
      </p>
      <nav className="flex gap-4">
        {routing.locales
          .filter((other) => other !== locale)
          .map((other) => (
            <Link
              key={other}
              href={`/${other}`}
              hrefLang={other}
              className="font-medium underline"
            >
              {other.toUpperCase()}
            </Link>
          ))}
      </nav>
    </main>
  );
}
