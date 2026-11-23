"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useLayoutEffect, useState } from "react";
import { ApiError, type Catalog, api } from "@/lib/api";
import { dateError, missingFields, useProjectForm } from "@/lib/use-project-form";
import { EditorHeader } from "./editor-header";
import { DetailsSection, SetupSection, TechSection } from "./form-sections";
import { ReadyCard } from "./ready-card";
import { RepoCard } from "./repo-card";
import { SECTIONS } from "./sections";
import { SideNav } from "./side-nav";
import { VideoCard } from "./video-card";

/** The upload page: owns the form and the catalog, and lays out every section. */
export function ProjectEditor() {
  const router = useRouter();
  const state = useProjectForm();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    api.catalog().then(setCatalog, () => setCatalogError(true));
  }, []);

  // The page was left (the form itself is reset by useProjectForm): start without old messages.
  useLayoutEffect(
    () => () => {
      setShowErrors(false);
      setRendering(false);
      setRenderError(null);
    },
    [],
  );

  if (catalogError) {
    return (
      <EditorLayout header={<EditorHeader />}>
        <p role="alert" className="text-[14px] text-danger">
          Could not reach the server. Reload the page to try again.
        </p>
      </EditorLayout>
    );
  }
  if (!catalog) return <EditorSkeleton />;

  const missing = missingFields(catalog, state.form, state.video, state.repo);
  const datesWrong = dateError(state.form);
  const errorFor = (field: string) => {
    if (datesWrong && (field === "started_on" || field === "finished_on")) return datesWrong;
    return showErrors && missing.has(field) ? "Required" : null;
  };

  async function render() {
    setShowErrors(true);
    setRenderError(null);
    if (missing.size > 0 || datesWrong) return scrollToFirstMissing(missing);
    setRendering(true);
    try {
      const project = await state.submit();
      router.push(`/projects/${project.slug}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "busy") return; // a second click while rendering
      setRenderError(e instanceof ApiError ? e.message : "Could not render the project");
      setRendering(false);
    }
  }

  const sectionProps = { form: state.form, setField: state.setField, catalog, errorFor };
  return (
    <EditorLayout
      header={<EditorHeader onRender={render} rendering={rendering} />}
      nav={<SideNav missing={missing} />}
      middle={
        <>
          <div className="order-1 lg:order-none">
            <DetailsSection {...sectionProps} />
          </div>
          <div className="order-3 lg:order-none">
            <TechSection {...sectionProps} />
          </div>
          <div className="order-4 lg:order-none">
            <SetupSection {...sectionProps} />
          </div>
        </>
      }
      right={
        <>
          <div id="demo" className="order-2 flex scroll-mt-4 flex-col gap-[14px] lg:order-none lg:gap-[13px]">
            <VideoCard state={state} catalog={catalog} error={errorFor("video")} />
            <RepoCard state={state} error={errorFor("repo")} />
          </div>
          {renderError && (
            <p role="alert" className="order-5 text-[13px] text-danger lg:order-none">
              {renderError}
            </p>
          )}
          <div className="order-5 lg:order-none lg:mt-[4px]">
            <ReadyCard missing={missing} />
          </div>
        </>
      }
    />
  );
}

function scrollToFirstMissing(missing: Set<string>) {
  const section = SECTIONS.find((s) => s.fields.some((f) => missing.has(f)));
  if (section) document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Page frame shared by the editor and its loading state, so nothing jumps when data arrives. */
function EditorLayout({
  header,
  nav,
  middle,
  right,
  children,
}: {
  header: ReactNode;
  nav?: ReactNode;
  middle?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {header}
      <main className="mx-auto max-w-[1280px] px-[16px] pb-[40px] pt-[13px] md:px-[24px] lg:pl-[31px] lg:pr-[29px]">
        <h1 className="text-[26px] font-extrabold leading-[32px] tracking-[-0.025em] text-ink lg:pl-[14px] lg:text-[32.7px] lg:leading-[38px]">
          Build your project page
        </h1>
        <p className="text-[15px] leading-[20px] text-muted lg:pl-[15px] lg:text-[15.4px]">
          Everything someone needs to understand your project.
        </p>
        {children ?? (
          // Desktop: side nav | form | video, repo, ready. Below 1024 px the two column wrappers
          // dissolve ("contents") and the cards stack in side-nav order (the order-* classes).
          <div className="mt-[18px] flex flex-col gap-[14px] lg:grid lg:grid-cols-[185px_minmax(0,511fr)_minmax(0,492fr)] lg:items-start lg:gap-x-[15px] lg:gap-y-0">
            <div className="hidden pt-[9px] lg:block">{nav}</div>
            <div className="contents lg:flex lg:flex-col lg:gap-[14px]">{middle}</div>
            <div className="contents lg:flex lg:flex-col lg:gap-[13px]">{right}</div>
          </div>
        )}
      </main>
    </div>
  );
}

export function EditorSkeleton() {
  const block = (height: number) => (
    <div className="animate-pulse rounded-[10px] border border-line bg-card" style={{ height }} />
  );
  return (
    <EditorLayout
      header={<EditorHeader />}
      nav={<div className="h-[160px]" />}
      middle={
        <>
          {block(400)}
          {block(142)}
          {block(260)}
        </>
      }
      right={
        <>
          {block(290)}
          {block(190)}
          {block(145)}
        </>
      }
    />
  );
}
