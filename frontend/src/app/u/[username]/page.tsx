import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { AccountNav } from "@/components/account/account-nav";
import { FeedHeader, ProjectCardView } from "@/components/feed/feed";
import { card, primaryButton } from "@/components/page/parts";
import { ProfileHead } from "@/components/profile/profile-head";
import { BackLink } from "@/components/project/back-link";
import { fetchCatalog, fetchProfile, getAccount } from "@/lib/server-api";

// A person's profile (/u/<username>, design: docs/design/profile-page/). Read on every request
// (fresh signed poster links), so the part that reads it sits inside a Suspense boundary.
export default function ProfilePage({ params }: PageProps<"/u/[username]">) {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<FeedHeader />}>
        <ProfileView params={params} />
      </Suspense>
    </div>
  );
}

async function ProfileView({ params }: { params: PageProps<"/u/[username]">["params"] }) {
  const { username } = await params;
  const catalog = await fetchCatalog();
  // An address no username could have never reaches the API.
  if (!new RegExp(catalog.username_rules.pattern).test(username.toLowerCase())) notFound();
  // Usernames are lowercase: /u/JasurBek moves to /u/jasurbek, so a profile has one address.
  if (username !== username.toLowerCase()) permanentRedirect(`/u/${username.toLowerCase()}`);
  const [profile, account] = await Promise.all([fetchProfile(username), getAccount()]);
  if (!profile) notFound();
  const { user, projects } = profile;
  const isOwner = account.state === "in" && account.me.username === user.username;
  return (
    <>
      <title>{`${user.display_name} (@${user.username}) - Prostagram`}</title>
      <FeedHeader
        account={
          <Suspense fallback={null}>
            <AccountNav />
          </Suspense>
        }
      />
      <main className="mx-auto flex max-w-[1920px] flex-col px-[16px] pb-[48px] pt-[16px] sm:px-[48px]">
        <BackLink />
        <ProfileHead user={user} />
        <h2 className="sr-only">Projects</h2>
        {projects.length === 0 ? (
          <ProfileEmpty name={user.display_name} isOwner={isOwner} />
        ) : (
          <ul className="mt-[24px] grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-gc">
            {projects.map((project) => (
              <ProjectCardView key={project.slug} project={project} catalog={catalog} heading="h3" footer="date" />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

/** No projects yet: the owner gets the way to add one; everyone else a way back to all projects. */
function ProfileEmpty({ name, isOwner }: { name: string; isOwner: boolean }) {
  return (
    <div className={`${card} mt-[24px] flex flex-col items-center gap-[12px] px-[24px] py-[64px] text-center`}>
      <p className="text-h font-semibold">No projects yet</p>
      <p className="max-w-[420px] text-body text-muted">
        {isOwner
          ? "Add your first one: a demo video, the story and the stack on one page. It shows here and in the feed."
          : `When ${name} publishes a project, it shows here.`}
      </p>
      {isOwner ? (
        <Link href="/new" className={primaryButton}>
          <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
          Add project
        </Link>
      ) : (
        <Link
          href="/"
          className="rounded-[4px] text-body font-medium text-primary-strong underline-offset-4 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-primary"
        >
          See all projects
        </Link>
      )}
    </div>
  );
}
