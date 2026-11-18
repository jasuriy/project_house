import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { safeExternalUrl } from "@/lib/safe-url";
import type { CommentPage, ProjectDetail } from "@/lib/types";
import { MediaPlayer } from "./MediaPlayer";
import { Avatar } from "@/components/Avatar";
import { DeleteProject } from "@/components/editor/DeleteProject";
import { Comments } from "@/components/social/Comments";
import { LikeButton, SaveButton } from "@/components/social/MarkButtons";
import { ReportDialog } from "@/components/social/ReportDialog";
import { ShareButton } from "./ShareButton";

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

/**
 * The project page body, laid out as mockup screens 2 and 2b. `viewer` is the signed-in username:
 * the owner gets Tahrirlash (or Oʻchirish for a sample) and no Shikoyat qilish. `comments` is the
 * first page of comments, null when it could not be loaded.
 */
export function ProjectView({
  project,
  viewer,
  comments,
}: {
  project: ProjectDetail;
  viewer: string | null;
  comments: CommentPage | null;
}) {
  const t = useTranslations("Project");
  const ts = useTranslations("Social");
  const tf = useTranslations("Fields");
  const tn = useTranslations("Nav");
  const locale = useLocale();
  const fieldLabel = tf(project.field);
  const authorUrl = project.author.kind === "demo" ? safeExternalUrl(project.author.url) : null;
  const isOwner = viewer !== null && project.author.kind === "user" && project.author.url === `/${viewer}`;
  // Logged out, the heart, Saqlash, Shikoyat and the write box go to login and come back here.
  const loginHref = viewer === null ? `/login?next=${encodeURIComponent(project.path)}` : null;

  const links = [
    { href: safeExternalUrl(project.github_url), label: t("github") },
    { href: safeExternalUrl(project.live_url), label: t("live") },
    { href: safeExternalUrl(project.demo_video_url), label: t("video") },
  ].filter((link): link is { href: string; label: string } => link.href !== null);

  return (
    <>
      <nav aria-label={t("breadcrumb")} className="mb-3.5 hidden text-small text-mute md:block">
        <ol className="flex flex-wrap items-center gap-x-1.5">
          <li>
            <Link href="/" className="hover:text-primary">
              {tn("feed")}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={{ pathname: "/", query: { field: project.field } }} className="hover:text-primary">
              {fieldLabel}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="truncate">
            {project.title}
          </li>
        </ol>
      </nav>

      {/* Desktop: media, Loyiha haqida and the comments on the left, the panel on the right across
          all three rows (the last row takes any extra height, so no gap opens under the text).
          Smaller screens: one column in source order. The media column is 768 px when there is
          room and narrower below about 1130 px, so the panel always keeps 320 px. */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,768px)_minmax(320px,1fr)] lg:grid-rows-[auto_auto_1fr] lg:gap-x-8 lg:gap-y-6">
        <div className="min-w-0">
          <MediaPlayer media={project.media} title={project.title} />
        </div>

        <article className="grid gap-4 rounded-card border border-border bg-card p-5.5 lg:col-start-2 lg:row-span-3 lg:row-start-1">
          <h1 className="text-h1 leading-[1.15] font-bold tracking-[-0.02em] text-fg">{project.title}</h1>
          <p className="text-lead text-fg">{project.one_line_problem}</p>

          {project.result && (
            <div className="grid gap-0.5 rounded-media bg-accent-soft px-3.5 py-3">
              <span className="text-meta text-mute">{t("result")}</span>
              <strong className="text-h2 leading-tight font-bold tracking-[-0.01em] text-fg tabular-nums">
                {project.result}
              </strong>
            </div>
          )}

          {project.tech_stack.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {project.tech_stack.map((tech) => (
                <li key={tech} className="rounded-chip border border-border bg-muted px-2.5 py-0.75 text-meta text-fg">
                  {tech}
                </li>
              ))}
            </ul>
          )}

          <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-small">
            <dt className="text-mute">{t("field")}</dt>
            <dd className="text-fg">{fieldLabel}</dd>
            {project.role && (
              <>
                <dt className="text-mute">{t("role")}</dt>
                <dd className="text-fg">{project.role}</dd>
              </>
            )}
            <dt className="text-mute">{t("license")}</dt>
            <dd className="text-fg">{project.license ?? t("licenseNone")}</dd>
            <dt className="text-mute">{t("published")}</dt>
            <dd className="text-fg">{formatDate(project.published_at, locale)}</dd>
          </dl>

          <div className="h-px bg-border" />

          <div className="flex items-center gap-3">
            <Avatar
              name={project.author.name}
              src={project.author.avatar_url}
              className="size-11 border border-border bg-muted text-small font-semibold text-fg"
            />
            <div className="grid min-w-0 justify-items-start gap-0.5 text-ui font-semibold text-fg">
              {project.author.kind === "user" ? (
                <Link href={project.author.url} className="inline-flex min-h-11 max-w-full items-center truncate hover:text-primary md:min-h-0">
                  {project.author.name}
                </Link>
              ) : authorUrl ? (
                <a href={authorUrl} {...EXTERNAL} className="inline-flex min-h-11 max-w-full items-center truncate hover:text-primary md:min-h-0">
                  {project.author.name}
                </a>
              ) : (
                <span className="truncate">{project.author.name}</span>
              )}
              {project.author.kind === "demo" && (
                <span className="rounded-full bg-accent-soft px-2 py-px text-caption font-medium text-primary">
                  {t("sample")}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <LikeButton projectId={project.id} liked={project.liked} count={project.like_count} loginHref={loginHref} />
            <SaveButton projectId={project.id} saved={project.saved} loginHref={loginHref} />
          </div>

          <div className="flex flex-wrap items-center gap-x-4.5 gap-y-1 text-small">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                {...EXTERNAL}
                className="inline-flex min-h-11 items-center text-primary hover:underline md:min-h-0"
              >
                {link.label}
              </a>
            ))}
            <ShareButton label={t("share")} copiedLabel={t("copied")} />
            {isOwner && !project.is_demo && (
              <Link href={`${project.path}/edit`} className="inline-flex min-h-11 items-center rounded-control text-small font-semibold text-primary hover:underline md:min-h-0">
                {t("edit")}
              </Link>
            )}
            {isOwner && project.is_demo && viewer && (
              <DeleteProject slug={project.slug} title={project.title} username={viewer} look="link" />
            )}
            {!isOwner && (
              <ReportDialog
                target={{ project_id: project.id }}
                description={ts("reportProject", { title: project.title })}
                loginHref={loginHref}
                triggerClassName="inline-flex min-h-11 items-center rounded-control text-small text-mute hover:underline md:min-h-0"
              />
            )}
          </div>

          {project.author.kind === "demo" && (
            <p className="text-meta text-mute">{t("sampleNotice", { name: project.author.name })}</p>
          )}
        </article>

        <section className="lg:col-start-1">
          <h2 className="text-h3 font-semibold text-fg">{t("about")}</h2>
          <p className="mt-2 max-w-[75ch] text-body text-fg">{project.short_description}</p>
        </section>

        <div className="mt-3 min-w-0 lg:col-start-1 lg:mt-1">
          <Comments
            projectId={project.id}
            initial={comments}
            count={project.comment_count}
            viewer={viewer}
            loginHref={loginHref}
          />
        </div>
      </div>
    </>
  );
}
