import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { VerifyEmail } from "@/components/auth/VerifyEmail";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { EMAIL_LOGIN } from "@/lib/features";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/[locale]/verify-email">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Verify" });
  // The URL carries a token: never send it to other sites in the Referer header.
  return { title: `${t("pageTitle")} - Project House`, referrer: "no-referrer" };
}

/** Emailni tasdiqlash (auth mockup screen 7). */
export default async function VerifyEmailPage({
  params,
  searchParams,
}: PageProps<"/[locale]/verify-email">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : null;
  setRequestLocale(locale);
  // GitHub sign-in only (the deployment): an old email link lands on the login page.
  if (!EMAIL_LOGIN) redirect({ href: "/login", locale });
  const user = await getCurrentUser();

  return (
    <AuthCard>
      <VerifyEmail
        token={token}
        loggedIn={user !== null}
        email={user?.email ?? null}
        alreadyVerified={user?.email_verified ?? false}
      />
    </AuthCard>
  );
}
