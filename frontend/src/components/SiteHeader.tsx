import { Plus, Settings } from "lucide-react";
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
      {user.account_type === "developer" && (
        // Mockup: a plus icon on a phone, "+ Qo'shish" on a tablet, "Loyiha qo'shish" on desktop.
        <Link
          href="/new"
          aria-label={t("addProject")}
          className="grid size-11 place-items-center rounded-control text-primary md:inline-flex md:size-auto md:min-h-10 md:items-center md:gap-1.5 md:bg-primary md:px-3.5 md:text-ui md:font-semibold md:whitespace-nowrap md:text-on-primary md:hover:opacity-90 lg:px-4"
        >
          <Plus aria-hidden strokeWidth={2.25} className="size-5 md:size-4 lg:hidden" />
          <span className="hidden md:inline lg:hidden">{t("addShort")}</span>
          <span className="hidden lg:inline">{t("addProject")}</span>
        </Link>
      )}
      <Link
        href={`/${user.username}`}
        className="hidden max-w-48 truncate rounded-control text-ui font-semibold text-fg hover:text-primary md:inline"
      >
        {user.display_name}
      </Link>
      {/* Icon on a phone (the 390 px header has no room for the word), text from 768 px. */}
      <NavLink href="/settings" aria-label={t("settings")}>
        <Settings aria-hidden strokeWidth={2} className="size-5 md:hidden" />
        <span className="hidden md:inline">{t("settings")}</span>
      </NavLink>
      {/* A 360 px phone header has room for language, add and settings only: logout is in Settings there. */}
      <div className="hidden md:block">
        <LogoutButton />
      </div>
    </div>
  );
}

export async function SiteHeader() {
  const t = await getTranslations("Nav");

  return (
    <header className="h-16 border-b border-border bg-card">
      <div className="page-width flex h-full items-center gap-4 md:gap-7">
        <Link
          href="/"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-control text-lead font-bold tracking-[-0.01em] text-fg"
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
