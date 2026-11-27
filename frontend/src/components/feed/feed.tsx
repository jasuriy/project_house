import { Bookmark, ChevronDown, CirclePlay, Heart, Plus, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/account/avatar";
import { card, Chip, primaryButton, TypeBadge } from "@/components/page/parts";
import { LogoMark } from "@/components/ui/icons";
import type { Catalog, ProjectCard } from "@/lib/api";
import { fullDate, labelOf } from "@/lib/catalog";
import { FeedVideo } from "./feed-video";
import { StackLine } from "./stack-line";

// The feed on the home page (Bek, 2026-11-25): a grid of project cards, newest first, with
// category tabs and a search in the header. Filters live in the address (?category=&q=), so a feed can
// be shared and works without any script: tabs are links, More is a details list, search a GET form.

/** Logo, the search in the middle (a GET form that keeps the chosen category), the account group. */
export function FeedHeader({ category = "", q = "", account }: { category?: string; q?: string; account?: ReactNode }) {
  return (
    <header className="bg-card shadow-[0_1px_0_var(--color-line)]">
      <div className="mx-auto grid min-h-[68px] max-w-[1920px] grid-cols-[1fr_minmax(0,560px)_1fr] items-center gap-[24px] px-[16px] sm:px-[48px] max-sm:grid-cols-[1fr_auto] max-sm:gap-y-[12px] max-sm:py-[12px]">
        <Link
          href="/"
          className="inline-flex h-[44px] items-center gap-[8px] justify-self-start text-[17px] font-bold text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-primary"
        >
          <LogoMark />
          Prostagram
        </Link>
        <form role="search" action="/" className="relative w-full max-sm:col-span-2 max-sm:row-start-2">
          {category && <input type="hidden" name="category" value={category} />}
          <label htmlFor="q" className="sr-only">
            Search projects
          </label>
          <Search size={18} strokeWidth={1.8} aria-hidden="true" className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={80}
            placeholder="Search projects or technologies"
            className="h-[44px] w-full rounded-full border border-transparent bg-page pl-[48px] pr-[18px] text-body text-ink outline-none transition-colors placeholder:text-faint hover:border-line focus:border-primary focus:bg-card focus:shadow-[0_0_0_3px_rgba(79,70,229,0.16)]"
          />
        </form>
        {/* The grid keeps the search in the middle whether or not the group is there yet. */}
        <div className="justify-self-end">{account}</div>
      </div>
    </header>
  );
}

// The categories that fit one row stay in it; the rest wait under "More".
const IN_ROW = 8;

/** Category tabs in one row: plain text, the chosen one on a soft background; the rest under "More". */
export function FeedToolbar({ catalog, category, q }: { catalog: Catalog; category: string; q: string }) {
  const href = (next: string) => {
    const query = new URLSearchParams();
    if (next) query.set("category", next);
    if (q) query.set("q", q);
    return query.size ? `/?${query}` : "/";
  };
  const tab = (active: boolean) =>
    "inline-flex h-[36px] shrink-0 items-center gap-[4px] whitespace-nowrap rounded-full px-[14px] text-[14px] outline-none transition-colors max-sm:h-[44px] " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
    (active ? "bg-ink/[0.06] font-semibold text-ink" : "font-medium text-muted hover:text-ink");
  const more = catalog.categories.slice(IN_ROW);
  const chosenInMore = more.find((c) => c.id === category);
  return (
    <div className="flex items-center justify-between gap-[24px] border-b border-line pb-[12px] max-desk:pb-[8px]">
      {/* Desktop: one row, the rest under More. Narrower screens: every category in a row that scrolls sideways. */}
      <nav aria-label="Categories" className="min-w-0 overflow-x-auto [scrollbar-width:none] max-desk:-mx-[16px] max-desk:px-[16px] sm:max-desk:-mx-[48px] sm:max-desk:px-[48px] desk:overflow-visible">
        <ul className="flex items-center gap-[4px]">
          <li>
            <Link href={href("")} aria-current={category ? undefined : "page"} className={tab(!category)}>
              All
            </Link>
          </li>
          {catalog.categories.map((c, i) => (
            <li key={c.id} className={i >= IN_ROW ? "desk:hidden" : undefined}>
              <Link href={href(c.id)} aria-current={category === c.id ? "page" : undefined} className={tab(category === c.id)}>
                {c.label}
              </Link>
            </li>
          ))}
          {more.length > 0 && (
            <li className="relative hidden desk:block">
              {/* A disclosure that needs no script: the list opens under the button. The key makes a
                  new choice render it again, closed (React would otherwise keep it open). */}
              <details key={category} className="group">
                <summary className={`${tab(!!chosenInMore)} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                  {chosenInMore?.label ?? "More"}
                  <ChevronDown size={16} strokeWidth={2} aria-hidden="true" className="transition-transform group-open:rotate-180" />
                </summary>
                <ul className="absolute left-0 top-[calc(100%+8px)] z-30 w-[220px] rounded-[12px] border border-line bg-card p-[6px] shadow-[0_12px_32px_-12px_rgba(23,22,47,0.28)]">
                  {more.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={href(c.id)}
                        aria-current={category === c.id ? "page" : undefined}
                        className={`flex h-[36px] items-center rounded-[8px] px-[10px] text-[14px] outline-none hover:bg-page focus-visible:bg-page ${
                          category === c.id ? "font-semibold text-ink" : "text-ink-2"
                        }`}
                      >
                        {c.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}

/** One project: first frame, name and status, description, tags, stack, author. The whole card opens the page. */
/**
 * One project card. In the feed the name is an h2 and the footer names the author (a link to their
 * profile); on a profile page the name is an h3 under the page's "Projects" and the footer shows the
 * published date instead, since the whole page is about that person.
 */
export function ProjectCardView({
  project,
  catalog,
  heading: Heading = "h2",
  footer = "author",
}: {
  project: ProjectCard;
  catalog: Catalog;
  heading?: "h2" | "h3";
  footer?: "author" | "date";
}) {
  const icons = new Map(catalog.tech.map((t) => [t.name, t.icon]));
  const stack = [...project.languages, ...project.tools].map((name) => ({ name, icon: icons.get(name) ?? null }));
  // The card is a box: its top part is the link to the page, its footer holds the author and the
  // Like and Save buttons (a button cannot sit inside a link).
  return (
    <li className={`${card} group flex min-w-0 flex-col overflow-hidden transition-shadow hover:shadow-[0_12px_32px_-16px_rgba(23,22,47,0.28)]`}>
      <Link
        href={`/projects/${project.slug}`}
        className="flex flex-1 flex-col outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <div className="relative aspect-video overflow-hidden bg-[#17162f]">
          {project.poster_url ? (
            // A signed R2 link that changes on every request: a plain img, not the image optimizer.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.poster_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[#9b98c4]">
              <CirclePlay size={40} strokeWidth={1.5} aria-hidden="true" />
            </span>
          )}
          {project.preview_url && <FeedVideo src={project.preview_url} />}
        </div>
        <div className="flex flex-1 flex-col gap-[12px] p-[16px] pb-[12px]">
          <div className="flex flex-col gap-[4px]">
            <div className="flex items-start justify-between gap-[12px]">
              <Heading className="min-w-0 text-h font-semibold leading-[1.3] [overflow-wrap:anywhere]">{project.name}</Heading>
              {project.status && (
                <span className="mt-[3px] inline-flex shrink-0 items-center gap-[6px] text-cap text-muted">
                  <span aria-hidden="true" className="h-[8px] w-[8px] rounded-full bg-primary" />
                  {labelOf(catalog.statuses, project.status)}
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-body text-muted">{project.short_description}</p>
          </div>
          <div className="flex flex-wrap gap-[8px]">
            {project.project_type && <TypeBadge>{labelOf(catalog.project_types, project.project_type)}</TypeBadge>}
            {project.category && <Chip>{labelOf(catalog.categories, project.category)}</Chip>}
          </div>
          {stack.length > 0 && <StackLine items={stack} />}
        </div>
      </Link>
      <div className="mx-[16px] flex items-center justify-between gap-[8px] border-t border-line py-[8px]">
        {footer === "author" ? (
          <Link
            href={`/u/${project.owner.username}`}
            className="flex min-w-0 items-center gap-[8px] rounded-[8px] text-cap text-muted outline-none transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-primary"
          >
            <Avatar name={project.owner.display_name} src={project.owner.avatar_url} size={24} />
            <span className="truncate">{project.owner.display_name}</span>
          </Link>
        ) : (
          <time dateTime={project.published_at} className="text-cap text-muted">
            {fullDate(project.published_at)}
          </time>
        )}
        <CardActions name={project.name ?? "this project"} />
      </div>
    </li>
  );
}

/**
 * Like and Save. They only show for now (Bek, 2026-11-25): pressing them changes nothing until accounts
 * exist. Thin outline icons, like the rest of the page; 36px targets, 44px on a phone.
 */
function CardActions({ name }: { name: string }) {
  const button =
    "tap relative inline-flex h-[36px] w-[36px] items-center justify-center rounded-full text-muted outline-none transition-colors " +
    "hover:bg-page hover:text-ink focus-visible:outline-2 focus-visible:outline-primary";
  return (
    <div className="flex items-center gap-[2px]">
      <button type="button" aria-label={`Like ${name}`} aria-pressed="false" className={button}>
        <Heart size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <button type="button" aria-label={`Save ${name}`} aria-pressed="false" className={button}>
        <Bookmark size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  );
}

/** No projects at all, or none for these filters: say which, and give the next step. */
/** No projects. Add project goes to `/new` for a logged-in person, to sign-up first for a visitor. */
export function FeedEmpty({ filtered, addHref = "/new" }: { filtered: boolean; addHref?: string }) {
  return (
    <div className={`${card} flex flex-col items-center gap-[12px] px-[24px] py-[64px] text-center`}>
      <p className="text-h font-semibold">{filtered ? "No projects match" : "No projects yet"}</p>
      <p className="max-w-[420px] text-body text-muted">
        {filtered ? "Try another category or a shorter search." : "Add the first one: a demo video, the story and the stack on one page."}
      </p>
      {filtered ? (
        <Link href="/" className="text-[13px] font-semibold text-primary-strong underline-offset-4 hover:underline">
          Clear filters
        </Link>
      ) : (
        <Link href={addHref} className={primaryButton}>
          <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
          Add project
        </Link>
      )}
    </div>
  );
}
