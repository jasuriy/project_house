import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { NewProject } from "@/components/editor/NewProject";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/[locale]/new">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Editor" });
  return { title: `${t("title")} - Project House` };
}

/** Loyiha qo'shish (mockup screens 4a and 4): from GitHub, or by hand. Developers only. */
export default async function NewProjectPage({ params }: PageProps<"/[locale]/new">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/new", locale });
  const t = await getTranslations("Editor");

  if (user.account_type !== "developer") {
    return (
      <div className="mx-auto grid max-w-[640px] gap-3 rounded-card border border-border bg-card p-5 md:p-8 lg:mt-7">
        <h1 className="text-h2 font-bold tracking-[-0.015em] text-fg">{t("companyTitle")}</h1>
        <p className="text-body text-mute">{t("companyText")}</p>
        <Link href="/" className="inline-flex min-h-11 items-center text-ui font-semibold text-primary hover:underline md:min-h-0">
          {t("toFeed")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <h1 className="text-h2 font-bold tracking-[-0.015em] text-fg">{t("title")}</h1>
      <NewProject
        author={user.display_name}
        username={user.username}
        githubConnected={user.providers.includes("github")}
      />
    </div>
  );
}
