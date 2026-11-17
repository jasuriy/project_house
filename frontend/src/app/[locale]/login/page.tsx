import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { ProviderButtons } from "@/components/auth/ProviderButtons";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { apiGet } from "@/lib/api";
import { authErrorKey } from "@/lib/auth-errors";
import { getCurrentUser } from "@/lib/session";

const PROVIDER_NAMES: Record<string, string> = { google: "Google", github: "GitHub" };

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Login" });
  return { title: `${t("title")} - Project House` };
}

/** Kirish (auth mockup screen 1). Logged-in visitors go to the feed. */
export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  if (await getCurrentUser()) redirect({ href: "/", locale });

  const query = await searchParams;
  const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : null);
  const errorCode = one(query.error);
  const provider = PROVIDER_NAMES[one(query.provider) ?? ""] ?? "Google";

  const [t, te, providers] = await Promise.all([
    getTranslations("Login"),
    getTranslations("AuthErrors"),
    apiGet<{ providers: string[] }>("/api/v1/auth/providers"),
  ]);

  return (
    <AuthCard title={t("title")} sub={t("sub")}>
      {errorCode && (
        <p role="alert" className="rounded-media bg-warn-soft px-3.5 py-3 text-small text-warn-fg">
          {te(authErrorKey(errorCode), { provider })}
        </p>
      )}
      <ProviderButtons
        providers={providers.ok ? providers.data.providers : []}
        labels={{ google: t("google"), github: t("github") }}
        orLabel={t("or")}
      />
      <LoginForm next={one(query.next)} />
      <p className="text-center text-small text-mute">
        {t("noAccount")}{" "}
        <Link href="/signup" className="-my-3 inline-block rounded-control py-3 font-semibold text-primary hover:underline md:my-0 md:py-0">
          {t("signup")}
        </Link>
      </p>
    </AuthCard>
  );
}
