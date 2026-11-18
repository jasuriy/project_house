import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProjectForm } from "@/components/editor/ProjectForm";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { apiGet } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import type { EditableProject } from "@/lib/types";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[username]/[slug]/edit">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Editor" });
  return { title: `${t("editTitle")} - Project House` };
}

/**
 * Loyihani tahrirlash (mockup screen 4b). Only the owner sees the form: the /me API knows the
 * caller only, so a username that is not the viewer's is a 404 (never someone's own same-slug
 * project). Samples cannot be edited (delete only, from their page).
 */
export default async function EditProjectPage({
  params,
}: PageProps<"/[locale]/[username]/[slug]/edit">) {
  const { locale, username, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) return redirect({ href: `/login?next=/${username}/${slug}/edit`, locale });
  if (user.username !== username || user.account_type !== "developer") notFound();

  const cookie = (await headers()).get("cookie") ?? "";
  const project = await apiGet<EditableProject>(`/api/v1/me/projects/${encodeURIComponent(slug)}`, { cookie });
  if (!project.ok && project.status === 404) notFound();
  if (!project.ok) throw new Error(`edit page: ${project.code}`); // error.tsx shows the retry box
  if (project.data.is_demo) notFound();
  const t = await getTranslations("Editor");

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-h2 font-bold tracking-[-0.015em] text-fg">{t("editTitle")}</h1>
        <p className="mt-1.5 text-small break-words text-mute">
          {t("addressKept", { address: `${username}/${project.data.slug}` })}
        </p>
      </div>
      <ProjectForm author={user.display_name} username={user.username} project={project.data} />
    </div>
  );
}
