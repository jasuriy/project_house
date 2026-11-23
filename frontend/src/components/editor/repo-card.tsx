"use client";

import { File, FileText, Folder, Link, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { GitHubIcon, StatusDot } from "@/components/ui/icons";
import { ApiError, type RepoSnapshot, api } from "@/lib/api";
import type { ProjectDraft } from "@/lib/use-project-draft";

const PREVIEW_ROWS = 4;
const README_LINES = 3;

/** Linking the GitHub repository; shows the preview the backend stored. */
export function RepoCard({ draft, error: requiredError }: { draft: ProjectDraft; error: string | null }) {
  const repo = draft.project?.repo ?? null;
  const savedUrl = draft.project?.repo_url?.replace(/^https?:\/\//, "") ?? "";
  const [typed, setTyped] = useState<string | null>(null); // null: show the saved link
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = typed ?? savedUrl;

  async function link() {
    if (typed === null || typed.trim() === "" || typed.trim() === savedUrl) return;
    setLinking(true);
    setError(null);
    try {
      await draft.send((id) => api.linkRepo(id, typed.trim()));
      setTyped(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not link the repository");
    } finally {
      setLinking(false);
    }
  }

  const shownError = error ?? (repo ? null : requiredError);

  return (
    <Card icon={<GitHubIcon size={20} />} title="GitHub repository" subtitle="Link your project repository with source code, setup, and docs.">
      <div className="mt-[9px] flex flex-wrap items-center gap-x-[18px] gap-y-[8px]">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="repo_url" className="sr-only">
            Repository link
          </label>
          <div className="relative">
            <Link size={15} strokeWidth={1.8} aria-hidden="true" className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-ink-2" />
            <input
              id="repo_url"
              type="url"
              inputMode="url"
              placeholder="github.com/owner/repository"
              value={value}
              onChange={(e) => setTyped(e.target.value)}
              onBlur={() => void link()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void link();
                }
              }}
              aria-invalid={!!shownError || undefined}
              className={`h-[25px] w-full rounded-[7px] border bg-field pl-[33px] max-sm:h-[44px] max-sm:text-[16px] pr-[10px] text-[12.3px] text-ink-2 outline-none placeholder:text-faint focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 ${
                shownError ? "border-danger" : "border-field-line"
              }`}
            />
          </div>
        </div>
        {linking ? (
          <span className="flex items-center gap-[6px] text-[13px] text-muted">
            <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
            Checking...
          </span>
        ) : repo && typed === null ? (
          <span className="flex shrink-0 items-center gap-[6px] text-[12px] font-semibold text-success">
            <StatusDot done size={15} />
            Repository connected
          </span>
        ) : null}
      </div>
      {shownError && (
        <p role="alert" className="mt-[4px] text-[12px] text-danger">
          {shownError}
        </p>
      )}
      {repo && <RepoPreview repo={repo} />}
    </Card>
  );
}

function RepoPreview({ repo }: { repo: RepoSnapshot }) {
  // Hidden entries (.github, .devcontainer) say little about a project, so they are not shown.
  const visible = repo.entries.filter((e) => !e.name.startsWith("."));
  const readme = visible.find((e) => e.name.toLowerCase() === "readme.md");
  const rows = visible.filter((e) => e !== readme).slice(0, readme ? PREVIEW_ROWS - 1 : PREVIEW_ROWS);
  if (readme) rows.push(readme);

  return (
    <div className="mt-[9px] grid grid-cols-1 sm:grid-cols-[168px_1fr] overflow-hidden rounded-[8px] border border-line bg-[#fdf9fb]">
      <ul className="border-b border-line px-[5px] py-[5px] sm:border-b-0 sm:border-r" aria-label="Files">
        {rows.map((entry) => {
          const selected = entry === readme;
          return (
            <li
              key={entry.name}
              className={`flex h-[20px] items-center gap-[10px] rounded-[5px] px-[8px] text-[11.4px] ${
                selected ? "bg-primary-tint font-semibold text-ink" : "text-ink-2"
              }`}
            >
              {entry.type === "dir" ? (
                <Folder size={15} strokeWidth={1.7} className="shrink-0 text-[#3e7bf0]" aria-hidden="true" />
              ) : (
                <File size={15} strokeWidth={1.7} className={`shrink-0 ${selected ? "text-primary" : ""}`} aria-hidden="true" />
              )}
              <span className="truncate">{entry.type === "dir" ? `${entry.name}/` : entry.name}</span>
            </li>
          );
        })}
      </ul>
      <div className="min-w-0 px-[12px] py-[7px]">
        <p className="flex items-center gap-[8px] text-[11px] font-bold text-ink">
          <FileText size={14} strokeWidth={1.7} aria-hidden="true" />
          README.md
        </p>
        <ol className="mt-[5px] font-mono text-[7.5px] leading-[16px] max-sm:text-[10px] max-sm:leading-[18px] text-ink-2">
          {repo.readme_lines.slice(0, README_LINES).map((line, i) => (
            <li key={i} className="flex gap-[14px]">
              <span className="w-[10px] shrink-0 text-right text-faint">{i + 1}</span>
              <span className={`truncate ${i === 0 ? "font-bold" : ""}`}>{line}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
