import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { Banner } from "@/components/auth/Banner";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/session";

const PRIMARY =
  "inline-flex h-11 w-full items-center justify-center rounded-control bg-primary text-ui font-semibold text-on-primary hover:opacity-90";
const SECONDARY =
  "inline-flex h-11 w-full items-center justify-center rounded-control border border-border bg-card text-ui font-semibold text-fg hover:border-primary";

export async function generateMetadata({ params }: PageProps<"/[locale]/onboarding">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Onboarding" });
  return { title: `${t("pageTitle")} - Project House` };
}

/** Xush kelibsiz (auth mockup screen 8): after the first sign-up; `?verify=1` adds the email note. */
export default async function OnboardingPage({ params, searchParams }: PageProps<"/[locale]/onboarding">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login", locale });

  const t = await getTranslations("Onboarding");
  const askToVerify = (await searchParams).verify === "1" && !user.email_verified;
  const firstName = user.display_name.split(/\s+/)[0] || user.display_name;

  return (
    <AuthCard title={t("title", { name: firstName })} sub={t("sub")} wide>
      {askToVerify && <Banner tone="info">{t("verify")}</Banner>}
      <Link href="/" className={PRIMARY}>
        {t("feed")}
      </Link>
      <Link href="/settings" className={SECONDARY}>
        {t("settings")}
      </Link>
    </AuthCard>
  );
}
