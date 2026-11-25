"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useLayoutEffect, useState } from "react";
import { card, PageGrid } from "@/components/page/parts";
import { Byline } from "@/components/project/sections";
import { ApiError, type Catalog, api } from "@/lib/api";
import { dateError, missingFields, repoPending, useProjectForm } from "@/lib/use-project-form";
import { BuiltEditor } from "./built-editor";
import { EditorHeader } from "./editor-header";
import { FactsEditor } from "./facts-editor";
import { IdentEditor } from "./ident-editor";
import { RepoEditor } from "./repo-editor";
import { FOCUS_ORDER, isComplete, partsMatch, READY_PARTS } from "./sections";
import { StoryEditor } from "./story-editor";
import { VideoSlot } from "./video-slot";

const MESSAGES: Record<string, string> = {
  name: "Add the project's name.",
  short_description: "Add what it is and who it is for.",
  deliverables: "Choose at least one thing people get.",
  languages: "Add at least one language.",
  tools: "Add at least one framework or tool.",
  video: "Add a demo video.",
  problem: "Say what the problem is.",
  outcome: "Say what changed.",
};

/**
 * The upload page "U4" (D29): the project page itself, every value edited where it shows.
 * Owns the form and the catalog, and lays the parts out on the project page's grid.
 */
export function ProjectEditor() {
  const router = useRouter();
  const state = useProjectForm();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    api.catalog().then(setCatalog, () => setCatalogError(true));
  }, []);

  // The page was left (the form itself is reset by useProjectForm): start without old messages.
  useLayoutEffect(
    () => () => {
      setShowErrors(false);
      setRendering(false);
      setRenderError(null);
      setStatus("");
    },
    [],
  );

  if (catalogError) {
    return (
      <EditorLayout header={<EditorHeader />}>
        <p role="alert" className="text-cap text-danger">
          Could not reach the server. Reload the page to try again.
        </p>
      </EditorLayout>
    );
  }
  if (!catalog) return <EditorSkeleton />;
  if (process.env.NODE_ENV !== "production" && !partsMatch(catalog.required_fields)) {
    console.error("READY_PARTS does not hold exactly the catalog's required_fields", catalog.required_fields);
  }

  const missing = missingFields(catalog, state.form, state.video);
  const done = READY_PARTS.map((part) => isComplete(part.fields, missing));
  const repoWaiting = repoPending(state);
  // While the link is being checked the card shows "Checking", so no message then.
  const repoError = showErrors && repoWaiting && !state.repoLinking ? "Press Link to check it, or clear the field." : null;
  const datesWrong = dateError(state.form);
  const errorFor = (field: string) => {
    if (field === "started_on") return datesWrong;
    return showErrors && missing.has(field) ? (MESSAGES[field] ?? "Required") : null;
  };

  async function render() {
    setShowErrors(true);
    setRenderError(null);
    const bad = new Set<string>([...missing, ...(datesWrong ? ["started_on"] : [])]);
    if (bad.size > 0) {
      const left = READY_PARTS.filter((part) => !isComplete(part.fields, missing)).map((p) => p.label);
      setStatus(left.length ? `Not ready yet: ${left.join(", ")}.` : "Check the dates.");
      // Focus (and so scroll to) the first field that needs attention, in reading order.
      const first = FOCUS_ORDER.find(([field]) => bad.has(field));
      if (first) document.getElementById(first[1])?.focus();
      return;
    }
    if (repoWaiting) {
      setStatus("The repository link is not checked yet.");
      document.getElementById("repo_url")?.focus();
      return;
    }
    setRendering(true);
    setStatus("Rendering the project.");
    try {
      const project = await state.submit();
      router.push(`/projects/${project.slug}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "busy") return; // a second click while rendering
      const message = e instanceof ApiError ? e.message : "Could not render the project";
      setRenderError(message);
      setStatus(message);
      setRendering(false);
    }
  }

  const props = { form: state.form, setField: state.setField, catalog, errorFor };
  return (
    <EditorLayout header={<EditorHeader done={done} onRender={render} rendering={rendering} status={status} />}>
      <PageGrid
        first={<IdentEditor {...props} />}
        media={
          <>
            <VideoSlot state={state} catalog={catalog} error={errorFor("video")} />
            <Byline />
            <StoryEditor {...props} />
          </>
        }
        rest={[
          <FactsEditor key="facts" {...props} />,
          <BuiltEditor key="built" {...props} />,
          <div key="repo" className="flex flex-col gap-gs">
            <RepoEditor state={state} error={repoError} />
            {renderError && (
              <p role="alert" className="text-cap text-danger">
                {renderError}
              </p>
            )}
          </div>,
        ]}
      />
    </EditorLayout>
  );
}

/** Header and page frame, shared by the editor and its loading state, so nothing jumps when data arrives. */
function EditorLayout({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {header}
      <main className="mx-auto max-w-[1920px] px-[16px] py-[16px] sm:px-[48px]">
        <h1 className="sr-only">Build your project page</h1>
        {children}
      </main>
    </div>
  );
}

export function EditorSkeleton() {
  const block = (height: number) => <div className={`${card} animate-pulse`} style={{ height }} />;
  return (
    <EditorLayout header={<EditorHeader />}>
      <PageGrid
        first={block(213)}
        media={
          <>
            <div className={`${card} aspect-video animate-pulse`} />
            {block(40)}
            {block(153)}
          </>
        }
        rest={[block(65), block(137), block(234)]}
      />
    </EditorLayout>
  );
}
