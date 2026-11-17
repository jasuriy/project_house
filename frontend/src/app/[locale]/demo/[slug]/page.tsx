import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProjectPage, projectMetadata } from "@/components/projects/ProjectPage";
import { routing } from "@/i18n/routing";
import { getDemoProject } from "@/lib/projects";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/demo/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  setRequestLocale(locale);
  return projectMetadata(await getDemoProject(slug));
}

export default async function DemoProjectRoute({ params }: PageProps<"/[locale]/demo/[slug]">) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <ProjectPage result={await getDemoProject(slug)} />;
}
