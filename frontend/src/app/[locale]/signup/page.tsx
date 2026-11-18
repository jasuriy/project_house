import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { ProviderButtons } from "@/components/auth/ProviderButtons";
import { SignupForm } from "@/components/auth/SignupForm";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { EMAIL_LOGIN } from "@/lib/features";
import { apiGet } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/[locale]/signup">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Signup" });
  return { title: `${t("title")} - Project House` };
}

/** Roʻyxatdan oʻtish (auth mockup screen 3). Logged-in visitors go to the feed. */
export default async function SignupPage({ params }: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  if (await getCurrentUser()) redirect({ href: "/", locale });

  const [t, providers] = await Promise.all([
    getTranslations("Signup"),
    apiGet<{ providers: string[] }>("/api/v1/auth/providers"),
  ]);

  return (
    <AuthCard title={t("title")} sub={t("sub")} wide>
      <ProviderButtons
        providers={providers.ok ? providers.data.providers : []}
        labels={{ google: t("google"), github: t("github") }}
        orLabel={EMAIL_LOGIN ? t("or") : undefined}
      />
      {EMAIL_LOGIN && <SignupForm />}
      <p className="text-center text-small text-mute">
        {t("haveAccount")}{" "}
        <Link
          href="/login"
          className="-my-3 inline-block rounded-control py-3 font-semibold text-primary hover:underline md:my-0 md:py-0"
        >
          {t("login")}
        </Link>
      </p>
    </AuthCard>
  );
}
