import Link from "next/link";
import type { ReactNode } from "react";
import {
  card,
  Chip,
  factCell,
  factCellLast,
  factCellTimeline,
  factsStrip,
  factValue,
  stackGrid,
  stackLabel,
  DeliverableChip,
  OpenOnGitHub,
  RepoFiles,
  RepoIdentity,
  SegBar,
  STORY,
  StepHeading,
  TechChip,
  TypeBadge,
} from "@/components/page/parts";
import { LogoMark } from "@/components/ui/icons";
import { Avatar } from "@/components/account/avatar";
import type { Catalog, Owner, Project } from "@/lib/api";
import { labelOf, techRows, timeline } from "@/lib/catalog";
import { ClampText } from "./clamp-text";
import { DemoVideo } from "./demo-player";

// The project page "D7" (decision D29): on the left the name card, the facts, Built with and the
// repository; on the right the video, the author and the story. Server components: they only show
// data; the interactive parts (player, copy link, "more") are small client components.

/** The logo, and on the right the account group when given (the sign-up and login pages have none). */
export function SiteHeader({ account }: { account?: ReactNode }) {
  return (
    <header className="bg-card shadow-[0_1px_0_var(--color-line)]">
      <div className="mx-auto flex h-[52px] max-w-[1920px] items-center justify-between gap-[16px] px-[16px] sm:px-[48px]">
        <Link
          href="/"
          className="inline-flex h-[44px] items-center gap-[8px] text-[17px] font-bold text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-primary"
        >
          <LogoMark />
          Prostagram
        </Link>
        {account}
      </div>
    </header>
  );
}

export function IdentCard({ project, catalog }: { project: Project; catalog: Catalog }) {
  return (
    <section aria-labelledby="pt" className={`${card} flex flex-col gap-gi p-pi max-sm:p-[16px]`}>
      <div className="flex flex-col gap-[4px]">
        <div className="flex flex-wrap items-center justify-between gap-x-[16px] gap-y-[8px]">
          <h1 id="pt" className="min-w-0 text-title font-bold tracking-[-0.02em] [overflow-wrap:anywhere]">
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-[8px]">
            <TypeBadge>{labelOf(catalog.project_types, project.project_type)}</TypeBadge>
            <Chip>{labelOf(catalog.categories, project.category)}</Chip>
          </div>
        </div>
        <p className="text-h leading-[1.5] text-muted">{project.short_description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-[8px]">
        <span className="mr-[4px] text-cap text-muted">You get</span>
        {project.deliverables.map((id) => (
          <DeliverableChip key={id} id={id} label={labelOf(catalog.deliverables, id)} />
        ))}
      </div>
    </section>
  );
}

export function FactsStrip({ project, catalog }: { project: Project; catalog: Catalog }) {
  const value = factValue;
  return (
    <dl aria-label="Project facts" className={factsStrip}>
      <div className={factCell}>
        <div className="flex min-w-0 flex-col">
          <dt className="text-cap text-muted">Status</dt>
          <dd className={value}>
            <span aria-hidden="true" className="h-[8px] w-[8px] shrink-0 rounded-full bg-primary" />
            {labelOf(catalog.statuses, project.status)}
          </dd>
        </div>
      </div>
      <div className={factCellTimeline}>
        <div className="flex min-w-0 flex-1 flex-col">
          <dt className="text-cap text-muted">Timeline</dt>
          {/* Dates are optional; without them the cell stays and shows a dash (Bek, 2026-11-25). */}
          <dd className={value}>{timeline(project) ?? "–"}</dd>
        </div>
      </div>
      <div className={factCellLast}>
        <div className="flex min-w-0 flex-col">
          <dt className="text-cap text-muted">License</dt>
          <dd className={value}>{labelOf(catalog.licenses, project.license)}</dd>
        </div>
      </div>
    </dl>
  );
}

export function BuiltWith({ project, catalog }: { project: Project; catalog: Catalog }) {
  return (
    <section aria-labelledby="bw" className={`${card} flex flex-col gap-gi p-pc`}>
      <h2 id="bw" className="text-h font-semibold">
        Built with
      </h2>
      <div className={stackGrid}>
        {techRows(project, catalog).map(({ group, items }) => (
          <div key={group} className="contents">
            <span className={stackLabel}>{group}</span>
            <div className="flex flex-wrap gap-[8px]">
              {items.map((item) => (
                <TechChip key={item.name} name={item.name} icon={item.icon} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The repository preview (D18) in Get it running's former place; hidden without a repository (D25). */
export function RepoPreview({ project }: { project: Project }) {
  const repo = project.repo;
  if (!repo) return null;
  return (
    <section aria-labelledby="rp" className={`${card} flex flex-col gap-gi p-pc`}>
      <div className="flex items-center justify-between gap-[8px]">
        <h2 id="rp" className="text-h font-semibold">
          Repository
        </h2>
        <OpenOnGitHub url={repo.html_url} />
      </div>
      <RepoIdentity repo={repo} />
      <RepoFiles repo={repo} />
    </section>
  );
}

export function VideoFrame({ project }: { project: Project }) {
  return (
    <section
      aria-label="Demo video"
      className="relative aspect-video overflow-hidden rounded-[16px] border border-line bg-[#eef0f5] shadow-[0_12px_32px_-16px_rgba(23,22,47,0.28)]"
    >
      <DemoVideo slug={project.slug} video={project.video} />
    </section>
  );
}

/** Who published the project (on the upload page: who is about to). */
export function Byline({ owner }: { owner: Owner }) {
  return (
    <div className="flex items-center gap-[12px]">
      <Avatar name={owner.display_name} src={owner.avatar_url} size={40} className="shadow-[0_0_0_2px_var(--color-page),0_0_0_4px_#cfcbf6]" />
      <p className="min-w-0 text-body font-semibold leading-(--lh-cap) [overflow-wrap:anywhere]">
        {owner.display_name}
        <small className="block text-cap font-normal text-muted">Author</small>
      </p>
    </div>
  );
}

export function StoryCard({ project }: { project: Project }) {
  // How it works is optional: without it the story has two parts.
  const steps = STORY.filter((step) => project[step.field]);
  return (
    <section
      aria-label="The story"
      className={`${card} grid auto-cols-[minmax(0,1fr)] grid-flow-col gap-x-pi gap-y-gi px-pi py-pc max-sm:grid-flow-row max-sm:gap-[20px] max-sm:p-[16px]`}
    >
      {steps.map((step) => (
        <div key={step.field} className="flex min-w-0 flex-col gap-[8px]">
          <SegBar fill={step.fill} delay={step.delay} />
          <StepHeading icon={step.icon}>{step.title}</StepHeading>
          <ClampText text={project[step.field] ?? ""} />
        </div>
      ))}
    </section>
  );
}
