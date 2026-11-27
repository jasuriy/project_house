import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccountNav } from "@/components/account/account-nav";
import { PageGrid } from "@/components/page/parts";
import { BackLink } from "@/components/project/back-link";
import {
  BuiltWith,
  Byline,
  FactsStrip,
  IdentCard,
  RepoPreview,
  SiteHeader,
  StoryCard,
  VideoFrame,
} from "@/components/project/sections";
import { fetchCatalog, fetchPublishedProject } from "@/lib/server-api";

// The project is read on every request and never cached: it carries signed video links that
// expire after one hour. The address is known only per request, so the data part sits inside
// a Suspense boundary.
export default function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  return (
    <div className="min-h-screen">
      <SiteHeader
        account={
          <Suspense fallback={null}>
            <AccountNav />
          </Suspense>
        }
      />
      <Suspense fallback={<main className="px-[16px] py-[40px] text-muted sm:px-[48px]">Loading...</main>}>
        <ProjectView params={params} />
      </Suspense>
    </div>
  );
}

async function ProjectView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [project, catalog] = await Promise.all([fetchPublishedProject(slug), fetchCatalog()]);
  if (!project) notFound();

  // D7 (D29): details on the left, video on the right; the DOM follows the phone's order (PageGrid).
  return (
    <>
      <title>{`${project.name} - Prostagram`}</title>
      <main className="mx-auto max-w-[1920px] px-[16px] py-[16px] sm:px-[48px]">
        <BackLink />
        <PageGrid
          first={<IdentCard project={project} catalog={catalog} />}
          media={
            <>
              <VideoFrame project={project} />
              <Byline />
              <StoryCard project={project} />
            </>
          }
          rest={[
            <FactsStrip key="facts" project={project} catalog={catalog} />,
            <BuiltWith key="built" project={project} catalog={catalog} />,
            <RepoPreview key="repo" project={project} />,
          ]}
        />
      </main>
    </>
  );
}
