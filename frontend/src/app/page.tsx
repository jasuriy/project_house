import { Suspense } from "react";
import { AccountNav } from "@/components/account/account-nav";
import { FeedEmpty, FeedHeader, FeedToolbar, ProjectCardView } from "@/components/feed/feed";
import { fetchCatalog, fetchFeed, getAccount } from "@/lib/server-api";

// Home: the feed of published projects (Bek, 2026-11-25). It is read on every request (new projects
// and fresh signed image links), so the data part sits inside a Suspense boundary; the header is in
// it too, because its search box shows the current search.
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<FeedHeader />}>
        <Feed searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

async function Feed({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const params = await searchParams;
  // Started now, read only if the feed is empty (the header's group gets the same answer: cache()).
  const account = getAccount();
  const catalog = await fetchCatalog();
  // An unknown category in the address is ignored rather than turned into an error page.
  const category = catalog.categories.some((c) => c.id === one(params.category)) ? one(params.category) : "";
  const q = one(params.q).slice(0, 80);
  const projects = await fetchFeed({ category, q });
  return (
    <>
      <FeedHeader
        category={category}
        q={q}
        account={
          <Suspense fallback={null}>
            <AccountNav />
          </Suspense>
        }
      />
      <main className="mx-auto flex max-w-[1920px] flex-col gap-[24px] px-[16px] pb-[48px] pt-[16px] sm:px-[48px]">
        <h1 className="sr-only">Projects</h1>
        <FeedToolbar catalog={catalog} category={category} q={q} />
        {projects.length === 0 ? (
          <FeedEmpty
            filtered={!!(category || q)}
            addHref={(await account).state === "out" ? "/signup?next=%2Fnew" : "/new"}
          />
        ) : (
          <ul aria-label="Projects" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-gc">
            {projects.map((project) => (
              <ProjectCardView key={project.slug} project={project} catalog={catalog} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
