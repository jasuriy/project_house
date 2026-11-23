import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorSkeleton, ProjectEditor } from "@/components/editor/project-editor";

export const metadata: Metadata = { title: "New project - Prostagram" };

// The editor reads ?draft=<id> from the address, which is only known per request, so it sits
// inside a Suspense boundary; the skeleton has the same layout, so nothing jumps.
export default function NewProjectPage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <ProjectEditor />
    </Suspense>
  );
}
