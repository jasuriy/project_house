import {
  ArrowUpRight,
  CodeXml,
  Cog,
  Container,
  File,
  FileText,
  Folder,
  Globe,
  Package,
  Server,
  Smartphone,
  Target,
  Webhook,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { GitHubIcon, TechIcon } from "@/components/ui/icons";
import type { RepoSnapshot } from "@/lib/api";
import { previewEntries } from "@/lib/repo";

// The pieces the project page (D7) and the upload page (U4) draw the same way, so the upload page
// looks exactly like the page it produces (decision D29).

export const card = "rounded-[16px] border border-line bg-card";
/** The header's main button (Add project, Sign up). `outline-solid`: Tailwind 4's `outline-none`
 * sets the style to none, so without it the focus ring would not be drawn. */
export const primaryButton =
  "inline-flex h-[40px] items-center justify-center gap-[8px] whitespace-nowrap rounded-[8px] bg-primary px-[16px] text-[13px] font-semibold text-white " +
  "shadow-[0_1px_2px_rgba(79,70,229,0.25),0_4px_12px_rgba(79,70,229,0.2)] outline-none transition-colors hover:bg-primary-strong " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-primary max-sm:h-[44px]";
export const headerButton =
  "tap relative inline-flex h-[28px] shrink-0 items-center gap-[6px] rounded-[8px] border border-line bg-card px-[12px] text-[13px] font-semibold text-ink " +
  "outline-none transition-colors hover:bg-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// The facts strip: Status | Timeline | License in one row; on a phone Timeline takes its own row.
export const factsStrip = `${card} flex items-stretch max-sm:flex-wrap`;
export const factCell = "flex min-w-0 flex-1 basis-0 items-center justify-center px-[16px] py-[12px]";
export const factCellTimeline = `${factCell} border-l border-line max-sm:order-3 max-sm:basis-full max-sm:border-l-0 max-sm:border-t`;
export const factCellLast = `${factCell} border-l border-line`;
export const factValue = "flex items-center gap-[8px] whitespace-nowrap text-body font-semibold leading-(--lh-cap)";

// Built with: group labels in a column beside the chips; on a phone each label sits above its chips.
export const stackGrid = "grid grid-cols-[max-content_minmax(0,1fr)] items-start gap-x-[16px] gap-y-[8px] max-sm:grid-cols-1 max-sm:gap-y-[4px]";
export const stackLabel = "text-cap leading-(--chip) text-muted max-sm:mt-[8px] max-sm:leading-(--lh-cap) max-sm:first:mt-0";

const LEFT_ROWS = ["desk:row-start-2", "desk:row-start-3", "desk:row-start-4"];

/**
 * The page grid of D7 and U4 (D29). The DOM follows the phone's reading order: name card, the video
 * column (video, author, story), then the other cards, so keyboards and screen readers meet them in the
 * order a phone shows them. On desktop the name card and the others fill the left column's rows 1-4; the
 * video column is one block spanning rows 1-5, and the last row (1fr) takes its extra height, so the left
 * rows keep their own heights. Row gaps are margins, so an empty row adds nothing.
 */
export function PageGrid({ first, media, rest }: { first: ReactNode; media: ReactNode; rest: ReactNode[] }) {
  return (
    <div className="flex flex-col gap-gs desk:grid desk:grid-cols-[minmax(0,1fr)_minmax(0,calc((100%-var(--gc))*var(--lf)))] desk:grid-rows-[auto_auto_auto_auto_1fr] desk:items-start desk:gap-x-gc desk:gap-y-0">
      <div className="min-w-0 desk:col-start-1 desk:row-start-1">{first}</div>
      <div className="flex min-w-0 flex-col gap-gs desk:col-start-2 desk:row-[1/span_5]">{media}</div>
      {rest.map((item, i) => (
        <div key={i} className={`min-w-0 empty:hidden desk:col-start-1 desk:mt-gs ${LEFT_ROWS[i]}`}>
          {item}
        </div>
      ))}
    </div>
  );
}

const DELIVERABLE_ICONS: Record<string, LucideIcon> = {
  source_code: CodeXml,
  hosted_web_app: Globe,
  mobile_app: Smartphone,
  docker_setup: Container,
  package: Package,
  api: Webhook,
  self_hosted: Server,
};

export function TypeBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-chip items-center whitespace-nowrap rounded-full bg-badge px-[12px] text-cap font-semibold text-primary-ink">
      {children}
    </span>
  );
}

export function Chip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex h-chip items-center gap-[8px] whitespace-nowrap rounded-full bg-chip px-[12px] text-cap text-ink">
      {icon}
      {children}
    </span>
  );
}

export function DeliverableIcon({ id }: { id: string }) {
  const Icon = DELIVERABLE_ICONS[id] ?? Package;
  return <Icon size={16} strokeWidth={2} className="shrink-0 text-primary" aria-hidden="true" />;
}

export function DeliverableChip({ id, label }: { id: string; label: string }) {
  return <Chip icon={<DeliverableIcon id={id} />}>{label}</Chip>;
}

export function TechChip({ name, icon }: { name: string; icon: string | null }) {
  return (
    <span className="inline-flex h-chip items-center gap-[8px] whitespace-nowrap rounded-full border border-line bg-card pl-[8px] pr-[12px] text-cap text-ink">
      <TechIcon name={name} slug={icon} size={16} />
      {name}
    </span>
  );
}

/** The three parts of the story, in reading order; each fills its segment of the bar in turn. */
export const STORY = [
  { field: "problem", title: "The problem", icon: Target, fill: "bg-seg-1", delay: "0.25s" },
  { field: "how_it_works", title: "How it works", icon: Cog, fill: "bg-seg-2", delay: "0.75s" },
  { field: "outcome", title: "The result", icon: Zap, fill: "bg-primary", delay: "1.25s" },
] as const;

export function SegBar({ fill, delay }: { fill: string; delay: string }) {
  return (
    <span aria-hidden="true" className="mb-[4px] block h-[4px] overflow-hidden rounded-[2px] bg-track">
      <i className={`block h-full origin-left rounded-[2px] animate-seg-fill motion-reduce:animate-none ${fill}`} style={{ animationDelay: delay }} />
    </span>
  );
}

export function StepHeading({ icon: Icon, children, htmlFor }: { icon: LucideIcon; children: ReactNode; htmlFor?: string }) {
  const content = (
    <>
      <Icon size={18} strokeWidth={2} className="shrink-0 text-primary" aria-hidden="true" />
      {children}
    </>
  );
  const cls = "flex items-center gap-[8px] text-h font-semibold";
  return htmlFor ? (
    <label htmlFor={htmlFor} className={cls}>
      {content}
    </label>
  ) : (
    <h2 className={cls}>{content}</h2>
  );
}

export function OpenOnGitHub({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={headerButton}>
      Open on GitHub
      <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" />
    </a>
  );
}

/** Name, visibility and description of the linked repository (40px high, 48px on wide screens). */
export function RepoIdentity({ repo }: { repo: RepoSnapshot }) {
  return (
    <div className="flex min-h-[max(40px,calc(2*var(--lh-cap)))] min-w-0 items-center gap-[12px]">
      <span className="shrink-0 text-ink">
        <GitHubIcon size={28} />
      </span>
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-[8px] text-body font-semibold leading-(--lh-cap)">
          <span className="truncate">{repo.full_name}</span>
          <span className="shrink-0 rounded-full border border-line px-[8px] text-cap font-normal leading-[calc(var(--lh-cap)-2px)] text-muted">
            Public
          </span>
        </p>
        {repo.description && <p className="truncate text-cap text-muted">{repo.description}</p>}
      </div>
    </div>
  );
}

const row = "h-[calc(var(--lh-cap)+4px)]";

/** The root files and the first README lines, as stored when the repository was linked (D18). */
export function RepoFiles({ repo }: { repo: RepoSnapshot }) {
  const { rows, readme } = previewEntries(repo);
  return (
    <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] overflow-hidden rounded-[8px] border border-line bg-page max-sm:grid-cols-1">
      <ul aria-label="Files" className="min-w-0 border-r border-line p-[6px] max-sm:border-b max-sm:border-r-0">
        {rows.map((entry) => (
          <li
            key={entry.name}
            className={`flex min-w-0 items-center gap-[8px] whitespace-nowrap rounded-[8px] px-[8px] text-cap ${row} ${
              entry === readme ? "bg-badge text-ink" : "text-ink-2"
            }`}
          >
            {entry.type === "dir" ? (
              <Folder size={16} strokeWidth={2} className="shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <File size={16} strokeWidth={2} className="shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{entry.type === "dir" ? `${entry.name}/` : entry.name}</span>
          </li>
        ))}
      </ul>
      <div className="min-w-0 px-[12px] py-[6px]">
        <p className={`flex items-center gap-[8px] text-cap font-semibold ${row}`}>
          <FileText size={16} strokeWidth={2} aria-hidden="true" />
          README.md
        </p>
        {repo.readme_lines.length > 0 ? (
          <ol aria-label="README, first lines" className="font-mono text-mono leading-[calc(var(--lh-cap)+4px)] text-ink-2">
            {repo.readme_lines.slice(0, 3).map((line, i) => (
              <li key={i} className="flex min-w-0 gap-[12px]">
                <span className="shrink-0 text-faint">{i + 1}</span>
                <code className="truncate font-[inherit]">{line}</code>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-cap text-muted">No README in the repository.</p>
        )}
      </div>
    </div>
  );
}
