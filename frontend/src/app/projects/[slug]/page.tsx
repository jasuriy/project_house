import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  AtAGlance,
  Breadcrumb,
  DetailCards,
  Hero,
  RepoPreview,
  SiteHeader,
  SummaryCards,
  TechStack,
  VideoCard,
} from "@/components/project/sections";
import { labelOf } from "@/lib/catalog";
import { fetchCatalog, fetchPublishedProject } from "@/lib/server-api";

// The project is read on every request and never cached: it carries signed video links that
// expire after one hour. The address is known only per request, so the data part sits inside
// a Suspense boundary.
export default function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <Suspense fallback={<main className="px-[16px] py-[40px] text-muted md:px-[48px]">Loading...</main>}>
        <ProjectView params={params} />
      </Suspense>
    </div>
  );
}

async function ProjectView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [project, catalog] = await Promise.all([fetchPublishedProject(slug), fetchCatalog()]);
  if (!project) notFound();

  return (
    <>
      <title>{`${project.name} - Prostagram`}</title>
      {/* Full width, edges in line with the header (Bek, 2026-11-24, D27). */}
      <main className="px-[16px] pb-[48px] pt-[8px] md:px-[24px] lg:pl-[48px] lg:pr-[47px]">
        <div className="lg:pl-[4px]">
          <Breadcrumb category={labelOf(catalog.categories, project.category)} />
        </div>

        <div className="mt-[18px] grid grid-cols-1 gap-[16px] lg:grid-cols-[415px_repeat(3,minmax(0,1fr))] lg:gap-x-[17px] lg:gap-y-0">
          <div className="lg:pl-[3px]">
            <Hero project={project} catalog={catalog} />
          </div>
          <SummaryCards project={project} catalog={catalog} />
        </div>

        <div className="mt-[16px] grid grid-cols-1 items-start gap-[16px] lg:mt-[21px] lg:grid-cols-[minmax(0,730fr)_minmax(0,430fr)] lg:gap-[25px]">
          <VideoCard project={project} />
          <div className="lg:mt-[6px]">
            <AtAGlance project={project} catalog={catalog} />
          </div>
        </div>

        {/* The repository is optional (D25): without it the technology card takes the full row. */}
        <div
          className={`mt-[16px] grid grid-cols-1 items-start gap-[16px] lg:mt-[14px] lg:gap-[30px] ${
            project.repo ? "lg:grid-cols-[minmax(0,512fr)_minmax(0,643fr)]" : ""
          }`}
        >
          <TechStack project={project} catalog={catalog} />
          <RepoPreview project={project} />
        </div>

        <div className="mt-[16px] lg:mt-[19px]">
          <DetailCards project={project} catalog={catalog} />
        </div>
      </main>
    </>
  );
}
