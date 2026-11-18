import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotForm } from "@/components/auth/ForgotForm";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { EMAIL_LOGIN } from "@/lib/features";

export async function generateMetadata({ params }: PageProps<"/[locale]/forgot-password">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Forgot" });
  return { title: `${t("title")} - Project House` };
}

/** Parolni tiklash (auth mockup screen 5). */
export default async function ForgotPasswordPage({ params }: PageProps<"/[locale]/forgot-password">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // GitHub sign-in only (the deployment): an old email link lands on the login page.
  if (!EMAIL_LOGIN) redirect({ href: "/login", locale });
  const t = await getTranslations("Forgot");

  return (
    <AuthCard title={t("title")} sub={t("sub")}>
      <ForgotForm />
      <p className="text-center text-small text-mute">
        {t("remembered")}{" "}
        <Link href="/login" className="-my-3 inline-block rounded-control py-3 font-semibold text-primary hover:underline md:my-0 md:py-0">
          {t("login")}
        </Link>
      </p>
    </AuthCard>
  );
}
