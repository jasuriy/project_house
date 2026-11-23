import type { Metadata } from "next";
import { ProjectEditor } from "@/components/editor/project-editor";

export const metadata: Metadata = { title: "New project - Prostagram" };

// The upload page always starts empty: nothing is stored before Render, so it reads nothing from
// the address or the server except the catalog (loaded in the browser).
export default function NewProjectPage() {
  return <ProjectEditor />;
}
