import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { LoadMore } from "@/components/projects/LoadMore";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { ApiResult } from "@/lib/api";
import { getProfile, getUserProjects, isUsername } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session";
import type { FeedPage } from "@/lib/types";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[username]">): Promise<Metadata> {
  const { locale, username } = await params;
  if (!hasLocale(routing.locales, locale) || !isUsername(username)) return {};
  const profile = await getProfile(username);
  if (!profile.ok) return {};
  return { title: `${profile.data.display_name} (@${username}) - Project House` };
}

async function ProjectsGrid({ username, projects }: { username: string; projects: ApiResult<FeedPage> }) {
  const t = await getTranslations("Profile");
  const te = await getTranslations("Errors");
  if (!projects.ok) {
    return (
      <p role="alert" className="rounded-media border border-border bg-card px-4 py-6 text-center text-body text-fg">
        {projects.code === "unreachable" ? te("unreachable") : te("server")}
      </p>
    );
  }
  if (projects.data.items.length === 0) {
    return (
      <p className="rounded-media border border-border bg-card px-4 py-6 text-center text-body text-mute">
        {t("empty")}
      </p>
    );
  }
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {projects.data.items.map((card) => (
        <ProjectCard key={card.path} card={card} />
      ))}
      <LoadMore
        initialCursor={projects.data.next_cursor}
        endpoint={`/api/v1/users/${encodeURIComponent(username)}/projects`}
      />
    </div>
  );
}

/** A person's page: who they are and all their projects (mockup screens 3 and 3b). */
export default async function ProfileRoute({ params }: PageProps<"/[locale]/[username]">) {
  const { locale, username } = await params;
  if (!hasLocale(routing.locales, locale) || !isUsername(username)) notFound();
  setRequestLocale(locale);
  const [profile, projects, viewer] = await Promise.all([
    getProfile(username),
    getUserProjects(username),
    getCurrentUser(),
  ]);
  if (!profile.ok && profile.status === 404) notFound();
  const t = await getTranslations("Profile");
  const te = await getTranslations("Errors");

  if (!profile.ok) {
    return (
      <div role="alert" className="rounded-media border border-border bg-card px-4 py-6 text-center">
        <p className="text-body text-fg">
          {profile.code === "unreachable" ? te("unreachable") : te("server")}
        </p>
        <Link
          href={`/${username}`}
          className="mt-3 inline-flex min-h-11 items-center rounded-control px-2 text-ui font-semibold text-primary md:min-h-0"
        >
          {te("retry")}
        </Link>
      </div>
    );
  }

  const data = profile.data;
  const grid = <ProjectsGrid username={username} projects={projects} />;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[320px_1fr] lg:gap-8">
      <ProfileCard profile={data} isOwner={viewer?.username === username} />
      {data.account_type === "developer" ? (
        <ProfileTabs
          projectsLabel={t("projectsTab", { count: data.project_count })}
          aboutLabel={t("aboutTab")}
          about={data.about}
        >
          {grid}
        </ProfileTabs>
      ) : (
        <div className="grid min-w-0 gap-5">
          <section className="grid gap-2.5 rounded-card border border-border bg-card p-5.5">
            <h2 className="text-h3 font-semibold text-fg">{t("companyAbout")}</h2>
            <p className={`text-body whitespace-pre-line break-words ${data.about ? "text-fg" : "text-mute"}`}>
              {data.about ?? t("noAbout")}
            </p>
          </section>
          {data.project_count > 0 && grid}
        </div>
      )}
    </div>
  );
}
