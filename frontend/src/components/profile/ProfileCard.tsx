import { Bookmark, Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/Avatar";
import { ShareButton } from "@/components/projects/ShareButton";
import { Link } from "@/i18n/navigation";
import { profileLinks } from "@/lib/profile";
import type { Profile } from "@/lib/types";

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;
// Grow to share the row, wrap when a translation is too long for half of it.
const BUTTON =
  "inline-flex h-11 flex-auto items-center justify-center rounded-control px-4 text-ui font-semibold whitespace-nowrap md:h-10 md:max-lg:flex-none";
const PRIMARY = `${BUTTON} bg-primary text-on-primary hover:opacity-90`;
const GHOST = `${BUTTON} border border-border bg-card text-fg hover:border-primary`;

/**
 * Who the person is (mockup 3 / 3b): a side column from 1024 px, a header card on a tablet
 * (photo left, everything else in the second column), stacked on a phone.
 */
export function ProfileCard({ profile, isOwner }: { profile: Profile; isOwner: boolean }) {
  const t = useTranslations("Profile");
  const tp = useTranslations("Project");
  const tm = useTranslations("Mine");
  const isDeveloper = profile.account_type === "developer";
  const links = profileLinks(profile.links);
  const facts = [
    isDeveloper ? null : profile.company_name,
    profile.location,
    isDeveloper ? profile.university_or_employer : null,
  ].filter((fact): fact is string => Boolean(fact));
  const second = "md:max-lg:col-start-2";

  return (
    <section
      aria-label={t("profileOf")}
      className="grid gap-3.5 rounded-card border border-border bg-card p-5.5 md:max-lg:grid-cols-[96px_1fr] md:max-lg:items-start md:max-lg:gap-x-5 md:max-lg:gap-y-1.5"
    >
      <Avatar
        name={profile.display_name}
        src={profile.avatar_url}
        className="size-24 border border-border bg-linear-135 from-avatar-from to-avatar-to text-[30px] font-bold text-fg md:max-lg:row-span-3"
      />
      <div className={`min-w-0 ${second}`}>
        <h1 className="text-h2 font-bold tracking-[-0.015em] break-words text-fg">
          {profile.display_name}
        </h1>
        {profile.headline && <p className="mt-1 text-ui break-words text-fg">{profile.headline}</p>}
      </div>
      {(isDeveloper ? profile.open_to_work : profile.is_verified_company) && (
        <p className={second}>
          <span
            className={`inline-block rounded-full px-2 py-px text-caption font-medium ${
              isDeveloper ? "bg-ok-soft text-ok" : "bg-accent-soft text-primary"
            }`}
          >
            {isDeveloper ? t("openToWork") : t("verifiedCompany")}
          </span>
        </p>
      )}
      {(facts.length > 0 || links.length > 0) && (
        <ul className={`grid gap-1.5 text-small text-mute md:max-lg:flex md:max-lg:flex-wrap md:max-lg:gap-x-4 md:max-lg:gap-y-1 ${second}`}>
          {facts.map((fact, i) => (
            <li key={i} className="min-w-0 [overflow-wrap:anywhere]">
              {fact}
            </li>
          ))}
          {links.map((link) => (
            <li key={link.key} className="min-w-0">
              <a
                href={link.href}
                {...EXTERNAL}
                className="inline-flex min-h-11 max-w-full items-center text-primary [overflow-wrap:anywhere] hover:underline md:min-h-0"
              >
                {link.key === "github" ? `GitHub: ${link.label}` : link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
      {isDeveloper && (
        <div className={`grid grid-cols-2 gap-2.5 md:max-lg:flex ${second}`}>
          <p className="grid rounded-[10px] bg-muted px-3 py-2.5">
            <b className="text-[20px] text-fg tabular-nums">{profile.project_count}</b>
            <span className="text-meta text-mute">
              {t("projectsStat", { count: profile.project_count })}
            </span>
          </p>
          <p className="grid rounded-[10px] bg-muted px-3 py-2.5">
            <b className="text-[20px] text-fg tabular-nums">{profile.like_total}</b>
            <span className="text-meta text-mute">{t("likesStat", { count: profile.like_total })}</span>
          </p>
        </div>
      )}
      <div className={`flex flex-wrap gap-2 md:max-lg:order-last ${second}`}>
        {isOwner && (
          <Link href="/settings/profile" className={PRIMARY}>
            {t("editProfile")}
          </Link>
        )}
        <ShareButton label={tp("share")} copiedLabel={tp("copied")} className={GHOST} />
      </div>
      {/* Mockup 3c: your own lists, on your own profile only. */}
      {isOwner && (
        <div className={`flex flex-wrap gap-2 md:max-lg:order-last ${second}`}>
          <Link href="/saved" className={`${GHOST} gap-2`}>
            <Bookmark aria-hidden className="size-4.5" />
            {tm("saved")}
          </Link>
          <Link href="/liked" className={`${GHOST} gap-2`}>
            <Heart aria-hidden className="size-4.5" />
            {tm("liked")}
          </Link>
        </div>
      )}
      {isDeveloper && <p className={`text-meta text-mute ${second}`}>{t("privacy")}</p>}
    </section>
  );
}
