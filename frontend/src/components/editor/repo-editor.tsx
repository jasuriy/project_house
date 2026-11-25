"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { card, headerButton, OpenOnGitHub, RepoFiles, RepoIdentity } from "@/components/page/parts";
import { GitHubIcon } from "@/components/ui/icons";
import { ApiError, api } from "@/lib/api";
import { linkedRepoText, type ProjectFormState } from "@/lib/use-project-form";
import { PencilButton } from "./shared";

const button =
  "pick inline-flex h-[40px] shrink-0 items-center justify-center gap-[8px] rounded-[8px] border border-line bg-card px-[12px] text-[13px] font-semibold text-ink disabled:cursor-default disabled:text-muted max-sm:h-[44px] max-sm:min-w-[44px]";

/**
 * The repository card (optional, D25). Linked, it is the project page's preview plus a pencil.
 * Otherwise a link field: Link asks the server to read GitHub (nothing is saved before Render). The
 * typed text lives in the form state, so Render can refuse a link that was typed but never checked.
 */
export function RepoEditor({ state, error: renderError }: { state: ProjectFormState; error: string | null }) {
  const repo = state.repo?.snapshot ?? null;
  const linkedUrl = linkedRepoText(state.repo);
  const typed = state.repoText;
  const linking = state.repoLinking;
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false); // the pencil reopened the field of a linked repository

  // The page was left: the form is emptied (useProjectForm), so is this card.
  useLayoutEffect(
    () => () => {
      setError(null);
      setEditing(false);
    },
    [],
  );

  const value = typed ?? (editing ? linkedUrl : "");
  const showField = !repo || editing;

  function change(text: string) {
    setError(null);
    // Without a linked repository an emptied box is simply no link; while changing a linked one,
    // emptying the box does nothing until Save (Cancel must keep the old link).
    if (text.trim() === "" && !editing) state.setRepoText(null);
    else state.setRepoText(text);
  }

  async function link() {
    const text = (typed ?? "").trim();
    if (text === "") {
      if (editing) remove();
      return;
    }
    if (repo && text === linkedUrl) return cancel();
    state.setRepoLinking(true);
    setError(null);
    try {
      const snapshot = await api.previewRepo(text);
      state.setRepo({ url: snapshot.html_url, snapshot });
      state.setRepoText(null);
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not link the repository");
    } finally {
      state.setRepoLinking(false);
    }
  }

  function cancel() {
    setError(null);
    state.setRepoText(null);
    setEditing(false);
  }

  function remove() {
    setError(null);
    state.setRepo(null);
    state.setRepoText(null);
    setEditing(false);
  }

  const message = error ?? renderError;
  const header = (
    <div className="flex items-center justify-between gap-[8px]">
      <h2 id="rp" className="text-h font-semibold">
        Repository
      </h2>
      {repo && !editing ? (
        <div className="flex items-center gap-[8px]">
          <OpenOnGitHub url={repo.html_url} />
          <PencilButton aria-label={`Change or remove the repository ${repo.full_name}`} onClick={() => setEditing(true)} />
        </div>
      ) : (
        <span className="text-cap text-muted">Optional</span>
      )}
    </div>
  );

  return (
    <section aria-labelledby="rp" className={`${card} flex flex-col gap-gi p-pc`}>
      {header}
      {showField ? (
        <>
          <div className="flex flex-col gap-[4px]">
            {/* As high as the repository's name row it is replaced by (40px; 48px on wide screens). */}
            <div className={`flex min-h-[max(40px,calc(2*var(--lh-cap)))] items-center gap-[8px] ${editing ? "max-sm:flex-wrap" : ""}`}>
              <span className={`relative block min-w-0 flex-1 ${editing ? "max-sm:basis-full" : ""}`}>
                <span className="pointer-events-none absolute left-[12px] top-1/2 inline-flex -translate-y-1/2 text-ink">
                  <GitHubIcon size={18} />
                </span>
                <input
                  id="repo_url"
                  type="text"
                  inputMode="url"
                  autoFocus={editing}
                  value={value}
                  placeholder="github.com/owner/repo"
                  aria-label="GitHub repository, optional"
                  aria-invalid={!!message || undefined}
                  aria-describedby={message ? "repo_url-error" : undefined}
                  onChange={(e) => change(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void link();
                    }
                    if (e.key === "Escape" && editing) cancel();
                  }}
                  className={`h-[40px] w-full rounded-[8px] border bg-card pl-[38px] pr-[12px] text-[13px] text-ink outline-none max-sm:h-[44px] max-sm:text-[16px] placeholder:text-faint focus:border-primary focus:shadow-[0_0_0_3px_rgba(79,70,229,0.16)] ${
                    message ? "border-danger" : "border-[#d9d8e6]"
                  }`}
                />
              </span>
              <span className="flex shrink-0 items-center gap-[8px]">
                {linking ? (
                  <button type="button" disabled className={button}>
                    <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                    Checking
                  </button>
                ) : (
                  <button type="button" disabled={(typed ?? value).trim() === ""} onClick={() => void link()} className={button}>
                    {editing ? "Save" : "Link"}
                  </button>
                )}
                {editing && !linking && (
                  <>
                    <button type="button" onClick={cancel} className={`${headerButton} h-[40px] border-transparent bg-transparent max-sm:h-[44px]`}>
                      Cancel
                    </button>
                    <button type="button" aria-label="Remove the repository" onClick={remove} className={`${button} w-[40px] px-0 text-danger`}>
                      <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </>
                )}
              </span>
            </div>
            {message && (
              <p id="repo_url-error" role="status" className="text-cap text-danger">
                {message}
              </p>
            )}
          </div>
          {repo ? (
            <RepoFiles repo={repo} />
          ) : (
            <div className="flex min-h-[calc(4*(var(--lh-cap)+4px)+14px)] items-center justify-center rounded-[8px] px-[24px] text-center text-cap text-faint outline-1 -outline-offset-1 outline-dash outline-dashed">
              Its files and README show here once it is linked.
            </div>
          )}
        </>
      ) : (
        repo && (
          <>
            <RepoIdentity repo={repo} />
            <RepoFiles repo={repo} />
          </>
        )
      )}
    </section>
  );
}
