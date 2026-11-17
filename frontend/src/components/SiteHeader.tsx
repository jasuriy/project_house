import { Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LogoutButton } from "@/components/LogoutButton";
import { NavLink } from "@/components/NavLink";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";

/** Reads the session cookie, so it must stay inside its own <Suspense>. */
async function UserSlot() {
  const [t, user] = await Promise.all([getTranslations("Nav"), getCurrentUser()]);

  if (!user) {
    return (
      <div className="flex items-center gap-1 md:gap-2">
        <NavLink href="/login">{t("login")}</NavLink>
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
    <div className="flex items-center gap-1 md:gap-2">
      <span className="hidden max-w-48 truncate text-ui font-semibold text-fg md:inline">
        {user.display_name}
      </span>
      {/* Icon on a phone (the 390 px header has no room for the word), text from 768 px. */}
      <NavLink href="/settings" aria-label={t("settings")}>
        <Settings aria-hidden strokeWidth={2} className="size-5 md:hidden" />
        <span className="hidden md:inline">{t("settings")}</span>
      </NavLink>
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
          className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-control text-lead font-bold tracking-tight text-fg"
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
          <NavLink href="/">{t("feed")}</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2 md:gap-4">
          <Suspense
            fallback={<span aria-hidden className="inline-block h-11 w-16 md:h-10" />}
          >
            <LanguageSwitcher />
          </Suspense>
          <Suspense
            fallback={<span aria-hidden className="inline-block h-11 w-28" />}
          >
            <UserSlot />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
