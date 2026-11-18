import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/Avatar";
import { coverImage } from "@/lib/media";
import type { ProjectCard as Card } from "@/lib/types";
import { CoverImage } from "./CoverImage";

/**
 * One feed card, laid out as the mockup's `.card` (design-guide section 6). `preview` renders the
 * same card without the link (the add form's live preview points nowhere yet).
 */
export function ProjectCard({ card, preview = false }: { card: Card; preview?: boolean }) {
  const t = useTranslations("Feed");
  const cover = coverImage(card.cover);

  return (
    <article data-focus-ring className="grid content-start overflow-hidden rounded-card border border-border bg-card">
      <Body href={preview ? null : card.path}>
        <CoverImage src={cover.src} alt={card.title} isVideo={cover.isVideo} videoLabel={t("video")} />
        <div className="grid gap-2 px-3.5 pt-3 pb-3.5">
          <h2 className="line-clamp-2 text-base leading-tight font-semibold text-fg group-hover:text-primary">
            {card.title}
          </h2>
          <p className="line-clamp-2 min-h-[2.8em] text-small leading-[1.4] text-mute">
            {card.one_line_problem}
          </p>
          {card.tech_stack.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {card.tech_stack.map((tech) => (
                <li
                  key={tech}
                  className="rounded-chip border border-border bg-muted px-2 py-px text-caption text-fg"
                >
                  {tech}
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2 border-t border-border pt-2 text-meta text-mute">
            <Avatar name={card.author.name} src={card.author.avatar_url} fallback="blank" className="size-5.5 border border-border bg-muted" />
            <span className="truncate">{card.author.name}</span>
            {card.author.kind === "demo" && (
              <span className="ml-auto flex-none rounded-full bg-accent-soft px-2 py-px text-caption font-medium text-primary">
                {t("demo")}
              </span>
            )}
          </div>
        </div>
      </Body>
    </article>
  );
}

function Body({ href, children }: { href: string | null; children: ReactNode }) {
  const className = "group grid content-start rounded-card";
  if (href === null) return <div className={className}>{children}</div>;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
