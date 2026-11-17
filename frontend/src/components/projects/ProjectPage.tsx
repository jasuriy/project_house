import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { ApiResult } from "@/lib/api";
import type { ProjectDetail } from "@/lib/types";
import { ProjectView } from "./ProjectView";

/** Shared by /demo/[slug] and /[username]/[slug]: 404 page for a missing project, error box otherwise. */
export async function ProjectPage({ result }: { result: ApiResult<ProjectDetail> }) {
  if (!result.ok && result.status === 404) notFound();
  if (!result.ok) {
    const te = await getTranslations("Errors");
    return (
      <div role="alert" className="rounded-media border border-border bg-card px-4 py-6 text-center">
        <p className="text-body text-fg">
          {result.code === "unreachable" ? te("unreachable") : te("server")}
        </p>
        <Link
          href="/"
          className="mt-3 inline-flex min-h-11 items-center rounded-control px-2 text-ui font-semibold text-primary md:min-h-0"
        >
          {te("retry")}
        </Link>
      </div>
    );
  }
  return <ProjectView project={result.data} />;
}

export function projectMetadata(result: ApiResult<ProjectDetail>): Metadata {
  if (!result.ok) return {};
  const { title, one_line_problem: description } = result.data;
  return {
    title: `${title} - Project House`,
    description,
    openGraph: { title, description, type: "article" },
  };
}
