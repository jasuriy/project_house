"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { ApiError, type Catalog, api } from "@/lib/api";
import { useProjectDraft } from "@/lib/use-project-draft";
import { EditorHeader } from "./editor-header";
import { DetailsSection, SetupSection, TechSection } from "./form-sections";
import { ReadyCard } from "./ready-card";
import { RepoCard } from "./repo-card";
import { ALL_REQUIRED, SECTIONS } from "./sections";
import { SideNav } from "./side-nav";
import { VideoCard } from "./video-card";

/** The upload page: owns the draft and the catalog, and lays out every section. */
export function ProjectEditor() {
  const router = useRouter();
  const draft = useProjectDraft(useSearchParams().get("draft"));
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    api.catalog().then(setCatalog, () => setCatalogError(true));
  }, []);

  const missing = new Set(draft.project?.missing_fields ?? ALL_REQUIRED);
  const errorFor = (field: string) => (showErrors && missing.has(field) ? "Required" : null);

  async function render() {
    setShowErrors(true);
    setRenderError(null);
    if (!draft.project) return scrollToFirstMissing(missing);
    setRendering(true);
    try {
      const published = await draft.publish();
      router.push(`/projects/${published.slug}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "project_incomplete") scrollToFirstMissing(missing);
      else setRenderError(e instanceof ApiError ? e.message : "Could not render the project");
      setRendering(false);
    }
  }

  if (catalogError || draft.loadError) {
    return (
      <EditorLayout header={<EditorHeader />}>
        <p role="alert" className="text-[14px] text-danger">
          {draft.loadError ?? "Could not reach the server. Reload the page to try again."}
        </p>
      </EditorLayout>
    );
  }
  if (!catalog || draft.loading) return <EditorSkeleton />;

  const sectionProps = { form: draft.form, setField: draft.setField, catalog, errorFor };
  return (
    <EditorLayout
      header={
        <EditorHeader saveState={draft.saveState} saveError={draft.saveError} onRender={render} rendering={rendering} />
      }
      nav={<SideNav missing={missing} />}
      middle={
        <>
          <DetailsSection {...sectionProps} />
          <TechSection {...sectionProps} />
          <SetupSection {...sectionProps} />
        </>
      }
      right={
        <>
          <div id="demo" className="flex scroll-mt-4 flex-col gap-[13px]">
            <VideoCard draft={draft} catalog={catalog} error={errorFor("video")} />
            <RepoCard draft={draft} error={errorFor("repo")} />
          </div>
          {renderError && (
            <p role="alert" className="text-[13px] text-danger">
              {renderError}
            </p>
          )}
          <div className="mt-[4px]">
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
      <main className="mx-auto max-w-[1280px] pl-[31px] pr-[29px] pb-[40px] pt-[13px]">
        <h1 className="pl-[14px] text-[32.7px] font-extrabold leading-[38px] tracking-[-0.025em] text-ink">
          Build your project page
        </h1>
        <p className="pl-[15px] text-[15.4px] leading-[20px] text-muted">
          Everything someone needs to understand your project.
        </p>
        {children ?? (
          <div className="mt-[18px] grid grid-cols-[185px_minmax(0,511fr)_minmax(0,492fr)] items-start gap-x-[15px]">
            <div className="pt-[9px]">{nav}</div>
            <div className="flex flex-col gap-[14px]">{middle}</div>
            <div className="flex flex-col gap-[13px]">{right}</div>
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
