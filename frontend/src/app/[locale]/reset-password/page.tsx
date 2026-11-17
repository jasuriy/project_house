import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetForm } from "@/components/auth/ResetForm";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/reset-password">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Reset" });
  // The URL carries a token: never send it to other sites in the Referer header.
  return { title: `${t("title")} - Project House`, referrer: "no-referrer" };
}

/** Yangi parol (auth mockup screen 6). */
export default async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : null;
  setRequestLocale(locale);
  const t = await getTranslations("Forgot");

  return (
    <AuthCard>
      <ResetForm
        token={token}
        footer={
          <p className="text-center text-small text-mute">
            {t("remembered")}{" "}
            <Link href="/login" className="-my-3 inline-block rounded-control py-3 font-semibold text-primary hover:underline md:my-0 md:py-0">
              {t("login")}
            </Link>
          </p>
        }
      />
    </AuthCard>
  );
}
