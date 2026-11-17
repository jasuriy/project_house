import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LogoutButton } from "@/components/LogoutButton";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";

const LINK = "inline-flex min-h-11 items-center text-ui text-mute transition-colors hover:text-fg";

/** Reads the session cookie, so it must stay inside its own <Suspense>. */
async function UserSlot() {
  const [t, user] = await Promise.all([getTranslations("Nav"), getCurrentUser()]);

  if (!user) {
    return (
      <div className="flex items-center gap-3 md:gap-4">
        <Link href="/login" className={LINK}>
          {t("login")}
        </Link>
        <Link
          href="/signup"
          className="hidden min-h-10 items-center rounded-control bg-primary px-4 text-ui font-semibold text-on-primary transition-colors hover:opacity-90 md:inline-flex"
        >
          {t("signup")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 md:gap-3">
      <span className="hidden max-w-48 truncate text-ui font-semibold text-fg md:inline">
        {user.display_name}
      </span>
      <Link href="/settings" className={`${LINK} px-2`}>
        {t("settings")}
      </Link>
      <LogoutButton />
    </div>
  );
}

export async function SiteHeader() {
  const t = await getTranslations("Nav");

  return (
    <header className="border-b border-border bg-card">
      <div className="page-width flex h-16 items-center gap-4 md:gap-7">
        <Link
          href="/"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap text-[1.0625rem] font-bold tracking-tight text-fg"
        >
          <span
            aria-hidden
            className="grid size-6 place-items-center rounded-chip bg-deco text-caption font-bold text-on-primary"
          >
            P
          </span>
          Project House
        </Link>
        <nav aria-label="Project House" className="hidden md:block">
          <Link href="/" className={`${LINK} font-semibold text-fg`}>
            {t("feed")}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 md:gap-4">
          <Suspense fallback={<span aria-hidden className="h-10 w-28" />}>
            <LanguageSwitcher />
          </Suspense>
          <Suspense fallback={<span aria-hidden className="h-10 w-24" />}>
            <UserSlot />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
