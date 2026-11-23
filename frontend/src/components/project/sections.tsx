import {
  ArrowUpRight,
  Box,
  Calendar,
  ChevronDown,
  ChevronRight,
  Check,
  File,
  FileText,
  Folder,
  Globe,
  House,
  Laptop,
  Layers,
  Rocket,
  Scale,
  Server,
  Settings,
  Target,
  TriangleAlert,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { GitHubIcon, LogoMark, TechIcon } from "@/components/ui/icons";
import type { Catalog, Project } from "@/lib/api";
import { AUTHOR } from "@/lib/author";
import { labelOf, labelsOf, techRows, timeline } from "@/lib/catalog";
import { previewEntries } from "@/lib/repo";
import { TryDemoButton, VideoStage } from "./demo-player";

// The project page, built from docs/mockups/project-page.png. Server components: they only show
// data; the one interactive part (the demo player) lives in demo-player.tsx.

const card = "rounded-[12px] border border-line bg-card shadow-[0_1px_2px_rgba(20,16,50,0.03)]";

export function SiteHeader() {
  return (
    <header className="relative flex h-[52px] items-center border-b border-[#f0ebea] px-[16px] md:h-[42px] md:pl-[52px] md:pr-[50px]">
      <Link
        href="/"
        className="flex items-center gap-[8px] rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <LogoMark size={25} />
        <span className="text-[19.9px] font-extrabold tracking-[-0.015em] text-ink">Prostagram</span>
      </Link>
      {/* Static until the explore page exists (decision D6). */}
      <span className="absolute left-1/2 hidden -translate-x-1/2 text-[12.5px] font-semibold text-ink-2 md:block">
        Explore projects
      </span>
      <div className="ml-auto flex items-center gap-[38px]">
        <span className="text-ink" aria-hidden="true">
          <GitHubIcon size={20} />
        </span>
        <span className="flex items-center gap-[12px]">
          <Image src={AUTHOR.photo} alt={AUTHOR.name} width={25} height={25} className="rounded-full" />
          <ChevronDown size={14} strokeWidth={2.2} className="text-ink-2" aria-hidden="true" />
        </span>
      </div>
    </header>
  );
}

export function Breadcrumb({ category }: { category: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-[8px] text-[12px] text-muted">
      <House size={15} strokeWidth={1.8} aria-label="Home" className="text-ink-2" />
      <ChevronRight size={12} strokeWidth={2} aria-hidden="true" />
      <span>Projects</span>
      <span className="px-[2px]">/</span>
      <span aria-current="page">{category}</span>
    </nav>
  );
}

export function Hero({ project, catalog }: { project: Project; catalog: Catalog }) {
  const badge = [labelOf(catalog.project_types, project.project_type), project.ai_powered ? "AI powered" : null]
    .filter(Boolean)
    .join(" • ");
  return (
    <div>
      <span className="inline-flex h-[22px] items-center rounded-[6px] bg-[#dcd9ff] px-[8px] text-[12px] font-bold uppercase tracking-[0.01em] text-[#4a43c4]">
        {badge}
      </span>
      <h1 className="mt-[3px] text-[34px] font-extrabold leading-[42px] tracking-[-0.02em] text-ink md:text-[40.2px] md:leading-[48px]">
        {project.name}
      </h1>
      <p className="text-[16px] leading-[22px] text-[#3c3b4f] md:text-[16.5px]">{project.short_description}</p>
      <p className="mt-[6px] flex items-center gap-[10px] text-[12.2px] text-muted">
        <Image src={AUTHOR.photo} alt="" width={25} height={25} className="rounded-full" />
        <span>By {AUTHOR.name}</span>
        <span aria-hidden="true">&bull;</span>
        <span>{labelOf(catalog.statuses, project.status)}</span>
      </p>
      <div className="mt-[10px] flex flex-wrap gap-[16px]">
        <TryDemoButton />
        {project.repo_url && (
          <a
            href={project.repo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-[34px] w-[144px] items-center justify-center gap-[11px] rounded-[7px] border border-[#dcd5d4] bg-[#fefcfb] text-[13px] font-bold text-ink outline-none transition-colors hover:border-ink-2 focus-visible:ring-2 focus-visible:ring-primary/30 max-sm:h-[44px]"
          >
            <GitHubIcon size={17} />
            View source
          </a>
        )}
      </div>
    </div>
  );
}

function IconBox({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[8px] bg-[#e8e4f8] text-primary-strong">
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
    </span>
  );
}

function SummaryCard({ icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className={`${card} pb-[21px] pl-[17px] pr-[13px] pt-[12px]`}>
      <IconBox icon={icon} />
      <h2 className="mt-[8px] text-[17.2px] font-extrabold leading-[22px] tracking-[-0.01em] text-ink">{title}</h2>
      <div className="mt-[2px] text-[13.2px] leading-[17.5px] text-ink-2 max-sm:text-[14px] max-sm:leading-[20px]">{children}</div>
    </section>
  );
}

export function SummaryCards({ project, catalog }: { project: Project; catalog: Catalog }) {
  // Their own grid: equal heights among the three, but not stretched to the hero beside them.
  return (
    <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-3 lg:col-span-3 lg:mt-[9px] lg:gap-[17px] lg:self-start">
      <SummaryCard icon={Target} title="The problem">
        <p>{project.problem}</p>
      </SummaryCard>
      <SummaryCard icon={Zap} title="The outcome">
        <p>{project.outcome}</p>
      </SummaryCard>
      <SummaryCard icon={Layers} title="What you get">
        <ul className="mt-[5px] flex flex-col gap-[7px]">
          {labelsOf(catalog.deliverables, project.deliverables).map((item) => (
            <li key={item} className="flex items-center gap-[10px] text-[13.1px]">
              <Check size={15} strokeWidth={2.2} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </SummaryCard>
    </div>
  );
}

export function VideoCard() {
  return (
    <section aria-label="Demo video" className={`${card} p-[7px]`}>
      <VideoStage />
    </section>
  );
}

export function AtAGlance({ project, catalog }: { project: Project; catalog: Catalog }) {
  const when = timeline(project);
  const rows: { icon: LucideIcon; label: string; value: ReactNode }[] = [
    { icon: Laptop, label: "Type", value: labelOf(catalog.project_types, project.project_type) },
    { icon: Users, label: "For", value: project.audience },
    { icon: Globe, label: "Languages", value: labelsOf(catalog.post_languages, project.post_languages).join(" & ") },
    {
      icon: Layers,
      label: "Status",
      value: (
        <span className="inline-flex h-[24px] items-center rounded-[8px] bg-[#e4e1fb] px-[11px] text-primary">
          {labelOf(catalog.statuses, project.status)}
        </span>
      ),
    },
    { icon: Box, label: "Delivery", value: labelsOf(catalog.deliverables, project.deliverables).join(" + ") },
    ...(when ? [{ icon: Calendar, label: "Timeline", value: when }] : []),
  ];
  return (
    <section className={`${card} px-[20px] pb-[12px] pt-[7px] lg:min-h-[281px]`}>
      <h2 className="text-[17.5px] font-extrabold leading-[24px] tracking-[-0.01em] text-ink">At a glance</h2>
      <dl className="mt-[4px]">
        {rows.map(({ icon: Icon, label, value }, i) => (
          <div
            key={label}
            className={`grid min-h-[39px] grid-cols-[20px_120px_1fr] items-center gap-x-[10px] px-[3px] py-[6px] text-[12.9px] ${
              i < rows.length - 1 ? "border-b border-[#efe9e8]" : ""
            }`}
          >
            <Icon size={18} strokeWidth={1.6} aria-hidden="true" className="text-ink-2" />
            <dt className="text-[12.8px] font-bold text-ink">{label}</dt>
            <dd className="text-ink-2">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function TechStack({ project, catalog }: { project: Project; catalog: Catalog }) {
  const rows = techRows(project, catalog);
  return (
    <section className={`${card} px-[20px] pb-[14px] pt-[6px]`}>
      <h2 className="text-[17.4px] font-extrabold leading-[24px] tracking-[-0.01em] text-ink">Technology stack</h2>
      <dl className="mt-[3px]">
        {rows.map(({ group, items }, i) => (
          <div
            key={group}
            className={`grid grid-cols-1 items-center gap-y-[6px] py-[6px] sm:grid-cols-[116px_1fr] ${
              i < rows.length - 1 ? "border-b border-[#efe9e8]" : ""
            }`}
          >
            <dt className="pl-[8px] text-[11.9px] font-bold text-ink">{group}</dt>
            <dd className="flex flex-wrap gap-[10px]">
              {items.map((t) => (
                <span
                  key={t.name}
                  className="inline-flex h-[25px] items-center gap-[9px] rounded-[8px] border border-[#ede7e6] bg-[#fdfaf9] px-[11px] text-[12px] font-medium text-ink-2 shadow-[0_1px_1px_rgba(20,16,50,0.03)]"
                >
                  <TechIcon name={t.name} slug={t.icon} size={17} />
                  {t.name}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function RepoPreview({ project }: { project: Project }) {
  const repo = project.repo;
  if (!repo) return null;
  const { rows, readme } = previewEntries(repo);
  return (
    <section className={`${card} px-[17px] pb-[15px] pt-[6px]`}>
      <h2 className="text-[16.6px] font-extrabold leading-[24px] tracking-[-0.01em] text-ink">Repository preview</h2>
      <div className="mt-[5px] flex items-start gap-[11px]">
        <span className="text-ink">
          <GitHubIcon size={29} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-[10px]">
            <span className="truncate text-[13.6px] font-bold text-ink">{repo.full_name}</span>
            <span className="rounded-full border border-[#e2dcdb] px-[8px] text-[11.5px] leading-[17px] text-muted">
              Public
            </span>
          </p>
          {repo.description && <p className="truncate text-[11.3px] text-muted">{repo.description}</p>}
        </div>
        <a
          href={repo.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-[9px] flex shrink-0 items-center gap-[6px] text-[12.1px] font-semibold text-primary hover:text-primary-strong max-sm:-mt-[4px] max-sm:min-h-[44px]"
        >
          Open on GitHub
          <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
        </a>
      </div>
      <div className="mt-[9px] grid grid-cols-1 overflow-hidden rounded-[8px] border border-line bg-[#fdf9fb] sm:grid-cols-[235px_1fr]">
        <ul aria-label="Files" className="border-b border-line px-[7px] py-[6px] sm:border-b-0 sm:border-r">
          {rows.map((entry) => {
            const selected = entry === readme;
            return (
              <li
                key={entry.name}
                className={`flex h-[24px] items-center gap-[13px] rounded-[6px] px-[10px] text-[11.8px] ${
                  selected ? "bg-primary-tint text-ink" : "text-ink-2"
                }`}
              >
                {entry.type === "dir" ? (
                  <Folder size={16} strokeWidth={1.7} className="shrink-0 text-[#3e7bf0]" aria-hidden="true" />
                ) : (
                  <File size={16} strokeWidth={1.7} className="shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{entry.type === "dir" ? `${entry.name}/` : entry.name}</span>
              </li>
            );
          })}
        </ul>
        <div className="min-w-0 px-[15px] py-[7px]">
          <p className="flex items-center gap-[9px] text-[11.8px] font-semibold text-ink">
            <FileText size={15} strokeWidth={1.7} aria-hidden="true" />
            README.md
          </p>
          <ol className="mt-[6px] font-mono text-[9.2px] leading-[20px] text-ink-2">
            {repo.readme_lines.slice(0, 3).map((line, i) => (
              <li key={i} className="flex gap-[18px]">
                <span className="w-[8px] shrink-0 text-right text-faint">{i + 1}</span>
                <span className={`truncate ${i === 0 ? "font-bold" : ""}`}>{line}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

// Width shares of the five bottom cards, measured from the mockup (they are not equal there).
const DETAIL_WEIGHTS: Record<string, number> = { how: 249, start: 240, req: 228, lim: 207, lic: 181 };

export function DetailCards({ project, catalog }: { project: Project; catalog: Catalog }) {
  const cards = [
    { key: "how", icon: Settings, title: "How it works", text: project.how_it_works },
    { key: "start", icon: Rocket, title: "Getting started", text: project.getting_started },
    { key: "req", icon: Server, title: "Requirements", text: project.requirements },
    { key: "lim", icon: TriangleAlert, title: "Limitations", text: project.limitations },
    { key: "lic", icon: Scale, title: "License", text: labelOf(catalog.licenses, project.license) },
  ].filter((c) => c.text);
  return (
    <div
      className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:[grid-template-columns:var(--detail-columns)] lg:gap-[20px]"
      style={{ "--detail-columns": cards.map((c) => `minmax(0,${DETAIL_WEIGHTS[c.key]}fr)`).join(" ") } as React.CSSProperties}
    >
      {cards.map(({ key, icon: Icon, title, text }) => (
        <section key={key} className={`${card} flex gap-[20px] px-[20px] pb-[13px] pt-[11px]`}>
          <Icon size={23} strokeWidth={1.6} aria-hidden="true" className="mt-[3px] shrink-0 text-ink-2" />
          <div className="min-w-0">
            <h2 className="text-[15.1px] font-extrabold leading-[21px] tracking-[-0.01em] text-ink">{title}</h2>
            <p className="mt-[2px] whitespace-pre-line text-[10.9px] leading-[16px] text-ink-2 max-sm:text-[13px] max-sm:leading-[19px]">{text}</p>
          </div>
        </section>
      ))}
    </div>
  );
}
