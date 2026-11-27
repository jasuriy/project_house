import { ArrowUpRight, CalendarDays } from "lucide-react";
import { Avatar } from "@/components/account/avatar";
import { GitHubIcon } from "@/components/ui/icons";
import type { Profile } from "@/lib/api";
import { monthYear } from "@/lib/catalog";

// The top of a profile page (design: docs/design/profile-page/): a short band on the page
// background, so the work under it is the hero. Photo or letter, the name, @username, and only the
// two facts there are data for: the GitHub account (when linked) and the month they joined.

const fact = "inline-flex h-[32px] items-center gap-[8px] text-body text-muted";

export function ProfileHead({ user }: { user: Profile["user"] }) {
  return (
    <section aria-labelledby="profile-name" className="flex items-center gap-[24px] border-b border-line pb-[24px]">
      {/* The ring is drawn 4px outside the photo; the margin puts its outer edge on the page's 48px line. */}
      <Avatar name={user.display_name} src={user.avatar_url} size={96} className="m-[4px] shadow-[0_0_0_2px_var(--color-page),0_0_0_4px_#cfcbf6]" />
      <div className="min-w-0">
        <h1 id="profile-name" className="text-title font-bold tracking-[-0.02em] [overflow-wrap:anywhere] [text-wrap:balance]">
          {user.display_name}
        </h1>
        <p className="mt-[4px] text-h leading-[1.5] text-muted">@{user.username}</p>
        <ul className="mt-[8px] flex flex-wrap items-center gap-x-[24px] gap-y-[4px]">
          {user.github_login && (
            <li>
              <a
                href={`https://github.com/${encodeURIComponent(user.github_login)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${user.github_login} on GitHub (opens in a new tab)`}
                className={`${fact} rounded-[8px] font-medium text-ink-2 underline-offset-4 outline-none transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-primary`}
              >
                <GitHubIcon size={16} />
                {user.github_login}
                <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" />
              </a>
            </li>
          )}
          <li>
            <span className={fact}>
              <CalendarDays size={16} strokeWidth={1.8} aria-hidden="true" />
              Joined {monthYear(`${user.joined}-01`)}
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}
