"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Banner } from "@/components/auth/Banner";
import { TextField } from "@/components/auth/TextField";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Link, useRouter } from "@/i18n/navigation";
import { clientPatch, clientPost } from "@/lib/client-api";
import { sameRepository } from "@/lib/github-link";
import { discardUpload } from "@/lib/upload";
import { youtubeId } from "@/lib/media";
import { type ProjectField, projectErrorField, projectErrorKey } from "@/lib/project-errors";
import {
  type EditableProject,
  FIELD_NAMES,
  type FieldName,
  type ImportPreview,
  type ProjectDetail,
} from "@/lib/types";
import { DeleteProject } from "./DeleteProject";
import { ImagePicker, type ImageItem } from "./ImagePicker";
import { TagsInput } from "./TagsInput";
import { TextAreaField } from "./TextAreaField";

// The backend limits (app/projects/editing.py).
const MAX = { title: 80, problem: 160, description: 1000, result: 160, role: 120, link: 200 };
const BUTTON =
  "inline-flex h-11 flex-1 items-center justify-center rounded-control px-4 text-ui font-semibold whitespace-nowrap md:h-10 md:flex-none";

type Values = {
  title: string;
  one_line_problem: string;
  short_description: string;
  result: string;
  role: string;
  field: FieldName | "";
  tech_stack: string[];
  github_url: string;
  live_url: string;
  video_url: string;
};

function startValues(project?: EditableProject, prefill?: ImportPreview): Values {
  return {
    title: project?.title ?? prefill?.title ?? "",
    one_line_problem: project?.one_line_problem ?? "",
    short_description: project?.short_description ?? prefill?.short_description ?? "",
    result: project?.result ?? "",
    role: project?.role ?? "",
    field: project?.field ?? "",
    tech_stack: project?.tech_stack ?? prefill?.tech_stack ?? [],
    github_url: project?.github_url ?? prefill?.github_url ?? "",
    live_url: project?.live_url ?? prefill?.live_url ?? "",
    video_url: project?.video_url ?? "",
  };
}

/** The "GitHub'dan" mark beside a label the import filled (mockup screen 4 `.ai` badge). */
function FromGitHub({ show, label }: { show: boolean; label: string }) {
  if (!show) return null;
  return <span className="rounded-full bg-accent-soft px-2 py-px text-caption font-medium text-primary">{label}</span>;
}

/**
 * Loyiha qo'shish / Loyihani tahrirlash (mockup screen 4): the fixed card fields, a video link and
 * up to 6 images, with the feed card as a live preview. `prefill` comes from the GitHub step.
 */
export function ProjectForm({
  author,
  username,
  project,
  prefill,
  onOtherRepo,
}: {
  author: string;
  username: string;
  project?: EditableProject;
  prefill?: ImportPreview;
  onOtherRepo?: () => void;
}) {
  const t = useTranslations("Editor");
  const te = useTranslations("EditorErrors");
  const tf = useTranslations("Fields");
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => startValues(project, prefill));
  const [images, setImages] = useState<ImageItem[]>(
    () => project?.images.map((image) => ({ key: `m${image.id}`, url: image.url, media: image.id })) ?? [],
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ field: ProjectField | "form"; message: string } | null>(null);

  const set = <K extends keyof Values>(name: K) => (value: Values[K]) =>
    setValues((current) => ({ ...current, [name]: value }));
  const fieldError = (field: ProjectField) => (error?.field === field ? error.message : undefined);
  const uploading = images.some((image) => image.uploading);
  const ready = images.filter((image) => !image.uploading && !image.error);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || uploading) return;
    const body = {
      ...values,
      images: ready.map((image) => (image.media !== undefined ? { media: image.media } : { upload: image.upload })),
    };
    setPending(true);
    setError(null);
    const result = project
      ? await clientPatch<ProjectDetail>(`/api/v1/me/projects/${encodeURIComponent(project.slug)}`, body)
      : await clientPost<ProjectDetail>("/api/v1/me/projects", body);
    if (result.ok) {
      router.push(result.data.path);
      return; // stay disabled while the project page opens
    }
    setPending(false);
    const field = projectErrorField(result.code);
    setError({ field, message: te(projectErrorKey(result.code)) });
    if (field !== "form") document.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
  }

  // The licence is read from GitHub when the link is saved: show what that link gave, or say so.
  const checkedLink = project?.github_url ?? prefill?.github_url ?? null;
  const checkedLicense = project?.license ?? prefill?.license ?? null;
  const licenseText = !values.github_url.trim()
    ? t("licenseNone")
    : sameRepository(checkedLink, values.github_url)
      ? checkedLicense
        ? t("licenseFromGithub", { license: checkedLicense })
        : t("licenseNone")
      : t("licenseOnSave");

  const cover = youtubeId(values.video_url)
    ? { kind: "video" as const, url: values.video_url }
    : ready[0]
      ? { kind: "image" as const, url: ready[0].url }
      : null;

  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-5 lg:grid-cols-[1fr_360px] lg:gap-8">
      <div className="grid gap-4.5 rounded-card border border-border bg-card p-5 md:p-5.5">
        {prefill && (
          <Banner tone="ok">
            {t(prefill.relation === "owner" ? "ownerBanner" : "contributorBanner", { login: prefill.github_login })}{" "}
            {onOtherRepo && (
              <button
                type="button"
                onClick={() => {
                  // Leaving this form: free the images uploaded so far (the 12-upload cap).
                  images.forEach((image) => image.upload && discardUpload(image.upload));
                  onOtherRepo();
                }}
                className="font-semibold underline"
              >
                {t("otherRepo")}
              </button>
            )}
          </Banner>
        )}
        {error?.field === "form" && <Banner tone="warn">{error.message}</Banner>}
        <TextField
          name="title"
          label={t("name")}
          required
          labelBadge={<FromGitHub show={Boolean(prefill?.title)} label={t("fromGithub")} />}
          defaultValue={values.title}
          maxLength={MAX.title}
          onChange={set("title")}
          error={fieldError("title")}
        />
        <TextField
          name="one_line_problem"
          label={t("problem")}
          required
          help={t("problemHelp")}
          defaultValue={values.one_line_problem}
          maxLength={MAX.problem}
          onChange={set("one_line_problem")}
          error={fieldError("one_line_problem")}
        />
        <TextAreaField
          name="short_description"
          label={t("description")}
          requiredMark
          labelBadge={<FromGitHub show={Boolean(prefill?.short_description)} label={t("fromGithub")} />}
          value={values.short_description}
          onChange={set("short_description")}
          maxLength={MAX.description}
          error={fieldError("short_description")}
        />
        <div className="grid gap-4.5 md:grid-cols-2 md:gap-4">
          <TextField name="result" label={t("result")} help={t("resultHelp")} defaultValue={values.result} maxLength={MAX.result} onChange={set("result")} error={fieldError("result")} />
          <TextField name="role" label={t("role")} defaultValue={values.role} maxLength={MAX.role} onChange={set("role")} error={fieldError("role")} />
        </div>
        <TextField
          name="video_url"
          label={t("video")}
          help={t("videoHelp")}
          placeholder="https://www.youtube.com/watch?v=..."
          defaultValue={values.video_url}
          maxLength={MAX.link}
          onChange={set("video_url")}
          error={fieldError("video_url")}
        />
        <ImagePicker images={images} setImages={setImages} error={fieldError("images")} />
        <div className="grid gap-4.5 md:grid-cols-2 md:gap-4">
          <TagsInput
            label={t("tech")}
            help={t("techHelp")}
            placeholder={t("techPlaceholder")}
            removeLabel={(tag) => t("removeTag", { tag })}
            tags={values.tech_stack}
            onChange={set("tech_stack")}
            error={fieldError("tech_stack")}
            labelBadge={<FromGitHub show={Boolean(prefill?.tech_stack.length)} label={t("fromGithub")} />}
          />
          <FieldSelect
            label={t("field")}
            pick={t("fieldPick")}
            value={values.field}
            onChange={set("field")}
            optionLabel={(name) => tf(name)}
            error={fieldError("field")}
          />
        </div>
        <div className="grid gap-4.5 md:grid-cols-2 md:gap-4">
          <TextField
            name="github_url"
            label={t("github")}
            labelBadge={<FromGitHub show={Boolean(prefill)} label={t("fromGithub")} />}
            placeholder="https://github.com/"
            defaultValue={values.github_url}
            maxLength={MAX.link}
            onChange={set("github_url")}
            error={fieldError("github_url")}
          />
          <label className="grid content-start gap-1.5">
            <span className="text-small font-semibold text-fg">{t("license")}</span>
            <input
              readOnly
              value={licenseText}
              className="h-11 rounded-control border border-border bg-muted px-3 text-ui text-mute md:h-10.5"
            />
          </label>
        </div>
        <TextField
          name="live_url"
          label={t("live")}
          help={t("liveHelp")}
          labelBadge={<FromGitHub show={Boolean(prefill?.live_url)} label={t("fromGithub")} />}
          placeholder="https://"
          defaultValue={values.live_url}
          maxLength={MAX.link}
          onChange={set("live_url")}
          error={fieldError("live_url")}
        />
        <div className="flex flex-wrap gap-2 border-t border-border pt-4 md:justify-end">
          {project && (
            <div className="w-full md:mr-auto md:w-auto">
              <DeleteProject slug={project.slug} title={project.title} username={username} look="button" />
            </div>
          )}
          <Link href={project ? project.path : `/${username}`} className={`${BUTTON} border border-border bg-card text-fg hover:border-primary`}>
            {t("cancel")}
          </Link>
          <button type="submit" disabled={pending || uploading} className={`${BUTTON} bg-primary text-on-primary hover:opacity-90 disabled:opacity-60`}>
            {project ? (pending ? t("saving") : t("save")) : pending ? t("publishing") : t("publish")}
          </button>
        </div>
      </div>

      <aside className="grid gap-2 lg:sticky lg:top-4">
        <p className="text-meta text-mute">{t("preview")}</p>
        <div className="md:max-w-[360px]">
          <ProjectCard
            preview
            card={{
              slug: "",
              path: "",
              title: values.title || t("previewTitle"),
              one_line_problem: values.one_line_problem || t("previewProblem"),
              field: values.field || "web",
              tech_stack: values.tech_stack.slice(0, 3),
              cover,
              author: { kind: "user", name: author, url: "" },
              published_at: new Date().toISOString(),
            }}
          />
        </div>
      </aside>
    </form>
  );
}

function FieldSelect({
  label,
  pick,
  value,
  onChange,
  optionLabel,
  error,
}: {
  label: string;
  pick: string;
  value: FieldName | "";
  onChange: (value: FieldName | "") => void;
  optionLabel: (name: FieldName) => string;
  error?: string;
}) {
  return (
    <label className="grid content-start gap-1.5">
      <span className="text-small font-semibold text-fg">
        {label}
        <span aria-hidden className="text-danger">
          {" "}
          *
        </span>
      </span>
      <select
        name="field"
        value={value}
        onChange={(event) => onChange(event.target.value as FieldName | "")}
        aria-invalid={error ? true : undefined}
        className={`h-11 rounded-control border bg-card px-3 text-ui text-fg md:h-10.5 ${error ? "border-danger" : "border-border"}`}
      >
        <option value="" disabled>
          {pick}
        </option>
        {FIELD_NAMES.map((name) => (
          <option key={name} value={name}>
            {optionLabel(name)}
          </option>
        ))}
      </select>
      {error && <span className="text-meta text-danger">{error}</span>}
    </label>
  );
}
