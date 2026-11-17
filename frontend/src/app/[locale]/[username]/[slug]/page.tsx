import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProjectPage, projectMetadata } from "@/components/projects/ProjectPage";
import { routing } from "@/i18n/routing";
import { getUserProject } from "@/lib/projects";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[username]/[slug]">): Promise<Metadata> {
  const { locale, username, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  setRequestLocale(locale);
  return projectMetadata(await getUserProject(username, slug));
}

export default async function UserProjectRoute({
  params,
}: PageProps<"/[locale]/[username]/[slug]">) {
  const { locale, username, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <ProjectPage result={await getUserProject(username, slug)} />;
}
