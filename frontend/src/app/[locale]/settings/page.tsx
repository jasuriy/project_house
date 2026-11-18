import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Banner } from "@/components/auth/Banner";
import { ProviderMark } from "@/components/auth/ProviderButtons";
import { LogoutButton } from "@/components/LogoutButton";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { apiGet } from "@/lib/api";
import { authErrorKey } from "@/lib/auth-errors";
import { getCurrentUser } from "@/lib/session";

const PROVIDERS = [
  { key: "google", name: "Google" },
  { key: "github", name: "GitHub" },
] as const;

const BADGE_OK = "rounded-full bg-ok-soft px-2 py-px text-caption font-medium text-ok";
const BADGE_INFO = "rounded-full bg-accent-soft px-2 py-px text-caption font-medium text-primary";
const BUTTON =
  "inline-flex h-11 flex-none items-center rounded-control border border-border bg-card px-3 text-small font-semibold md:h-8.5";
const CONNECT = `${BUTTON} text-fg hover:border-primary`;
// Dimmed: connecting is refused until the email is confirmed (the blue note above says why).
const BLOCKED = `${BUTTON} cursor-not-allowed text-mute`;

export async function generateMetadata({ params }: PageProps<"/[locale]/settings">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Settings" });
  return { title: `${t("title")} - Project House` };
}

/** Sozlamalar (auth mockup screen 9): email and its status, connected Google/GitHub accounts. */
export default async function SettingsPage({ params, searchParams }: PageProps<"/[locale]/settings">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/settings", locale });

  const [t, te, enabled] = await Promise.all([
    getTranslations("Settings"),
    getTranslations("AuthErrors"),
    apiGet<{ providers: string[] }>("/api/v1/auth/providers"),
  ]);
  const query = await searchParams;
  const errorCode = typeof query.error === "string" ? query.error : null;
  const providerName =
    PROVIDERS.find((p) => p.key === query.provider)?.name ?? PROVIDERS[0].name;
  const enabledSet = new Set(enabled.ok ? enabled.data.providers : []);
  // Connected providers always show; the others only when the backend has them switched on.
  const rows = PROVIDERS.filter((p) => user.providers.includes(p.key) || enabledSet.has(p.key));

  return (
    <div className="mx-auto grid w-full max-w-[640px] gap-5 rounded-card border border-border bg-card p-5 md:gap-6 md:p-8 lg:mt-7">
      <h1 className="text-h2 font-bold tracking-[-0.015em] text-fg">{t("title")}</h1>
      {errorCode && <Banner tone="warn">{te(authErrorKey(errorCode), { provider: providerName })}</Banner>}

      <section>
        <h2 className="mb-1 text-lead font-semibold text-fg">{t("profile")}</h2>
        <div className="flex flex-wrap items-center gap-x-5">
          <Link href="/settings/profile" className="inline-flex min-h-11 items-center text-ui font-semibold text-primary hover:underline md:min-h-0">
            {t("editProfile")}
          </Link>
          <Link href={`/${user.username}`} className="inline-flex min-h-11 items-center text-ui text-primary hover:underline md:min-h-0">
            {t("viewProfile")}
          </Link>
        </div>
      </section>

      <div className="h-px bg-border" />

      <section>
        <h2 className="mb-1 text-lead font-semibold text-fg">{t("email")}</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-ui text-fg">{user.email ?? t("noEmail")}</span>
          {user.email && (
            <span className={user.email_verified ? BADGE_OK : BADGE_INFO}>
              {user.email_verified ? t("verified") : t("unverified")}
            </span>
          )}
        </div>
      </section>

      {user.email && !user.email_verified && (
        <Banner tone="info">
          {t("verifyHint")}{" "}
          <Link href="/forgot-password" className="font-semibold text-primary underline">
            {t("verifyHintLink")}
          </Link>
          {t("verifyHintEnd")}
        </Banner>
      )}

      {rows.length > 0 && (
        <>
          <div className="h-px bg-border" />
          <section className="grid gap-3.5">
            <h2 className="mb-1 text-lead font-semibold text-fg">{t("connected")}</h2>
            {rows.map((provider) => {
              const connected = user.providers.includes(provider.key);
              const blocked = Boolean(user.email) && !user.email_verified;
              return (
                <div key={provider.key} className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5 text-ui text-fg">
                    <ProviderMark provider={provider.key} />
                    {provider.name}
                  </span>
                  {connected ? (
                    <span className={BADGE_OK}>{t("on")}</span>
                  ) : blocked ? (
                    <span className={BLOCKED}>
                      {t("connect")}
                    </span>
                  ) : (
                    // A full navigation: the browser follows the redirects to the provider and back.
                    <a href={`/api/v1/auth/oauth/${provider.key}/start`} className={CONNECT}>
                      {t("connect")}
                    </a>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}
      {/* The phone header has no logout button (no room at 360 px): it is here. */}
      <div className="-mb-2 border-t border-border pt-3 md:hidden">
        <LogoutButton />
      </div>
    </div>
  );
}
