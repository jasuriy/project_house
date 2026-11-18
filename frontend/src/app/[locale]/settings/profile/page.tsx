import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ProfilePhoto } from "@/components/profile/ProfilePhoto";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/settings/profile">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "ProfileForm" });
  return { title: `${t("title")} - Project House` };
}

/** Profilni tahrirlash (auth mockup screen 10): the signed-in user edits their own profile. */
export default async function EditProfilePage({ params }: PageProps<"/[locale]/settings/profile">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/settings/profile", locale });
  const t = await getTranslations("ProfileForm");

  return (
    <div className="mx-auto grid w-full max-w-[640px] gap-5 rounded-card border border-border bg-card p-5 md:gap-6 md:p-8 lg:mt-7">
      <div>
        <h1 className="text-h2 font-bold tracking-[-0.015em] text-fg">{t("title")}</h1>
        <Link
          href={`/${user.username}`}
          className="-my-3 mt-1 inline-flex min-h-11 items-center text-ui font-semibold text-primary hover:underline md:my-0 md:mt-1 md:min-h-0"
        >
          {t("viewProfile")}
        </Link>
      </div>
      <ProfilePhoto name={user.display_name} photo={user.avatar_url} />
      <div className="h-px bg-border" />
      <ProfileForm account={user} />
    </div>
  );
}
