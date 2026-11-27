import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EditorSkeleton, ProjectEditor } from "@/components/editor/project-editor";
import { getAccount } from "@/lib/server-api";

export const metadata: Metadata = { title: "New project - Prostagram" };

// Publishing needs an account (accounts step 3): a visitor is sent to log in first, before filling
// in a form that only Render would refuse. The upload page itself still starts empty: nothing is
// stored before Render, so it reads nothing else from the server here (the catalog loads in the
// browser).
export default function NewProjectPage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <NewProject />
    </Suspense>
  );
}

async function NewProject() {
  const account = await getAccount();
  if (account.state === "out") redirect("/login?next=%2Fnew");
  // "unknown" (the API could not say): the editor opens; Render answers "Log in first" if needed.
  const me = account.state === "in" ? account.me : null;
  return <ProjectEditor owner={me && { username: me.username, display_name: me.display_name, avatar_url: me.avatar_url }} />;
}
