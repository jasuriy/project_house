"use client";

import { LoaderCircle } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { OpenOnGitHub, RepoFiles, RepoIdentity } from "@/components/page/parts";
import { box, Field, FormSection } from "@/components/ui/form";
import { GitHubIcon } from "@/components/ui/icons";
import { ApiError, api } from "@/lib/api";
import { linkedRepoText, type ProjectFormState } from "@/lib/use-project-form";

const button =
  "inline-flex h-[44px] shrink-0 items-center justify-center gap-[8px] rounded-[10px] border border-[#d3d1e0] bg-card px-[16px] text-[13px] font-semibold text-ink outline-none transition-colors " +
  "hover:border-[#a9a7c0] hover:bg-page focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,0.16)] disabled:cursor-default disabled:text-muted disabled:hover:bg-card";

const small =
  "tap relative inline-flex h-[28px] items-center rounded-[8px] border border-[#d3d1e0] bg-card px-[12px] text-[13px] font-semibold text-ink outline-none transition-colors hover:bg-page focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,0.16)]";

/**
 * The repository section (optional, D25). A link field: Link asks the server to read GitHub (nothing
 * is saved before Render), then the project page's preview shows under it with Change and Remove.
 * The typed text lives in the form state, so Render can refuse a link that was typed but never checked.
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
  return (
    <FormSection
      id="repository"
      icon={GitHubIcon}
      title="Repository"
      aside={
        repo && !editing ? (
          <div className="flex items-center gap-[8px]">
            <button type="button" onClick={() => setEditing(true)} className={small}>
              Change
            </button>
            <button type="button" onClick={remove} className={`${small} text-danger`}>
              Remove
            </button>
          </div>
        ) : (
          <span className="text-cap text-muted">Optional</span>
        )
      }
    >
      {showField ? (
        <Field id="repo_url" label="GitHub link" message={message}>
          <div className={`flex items-center gap-[8px] ${editing ? "max-sm:flex-wrap" : ""}`}>
            <span className={`relative block min-w-0 flex-1 ${editing ? "max-sm:basis-full" : ""}`}>
              <span aria-hidden="true" className="pointer-events-none absolute left-[14px] top-1/2 inline-flex -translate-y-1/2 text-ink">
                <GitHubIcon size={18} />
              </span>
              <input
                id="repo_url"
                type="text"
                inputMode="url"
                autoFocus={editing}
                value={value}
                placeholder="github.com/owner/repo"
                aria-invalid={!!message || undefined}
                aria-describedby={message ? "repo_url-message" : undefined}
                onChange={(e) => change(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void link();
                  }
                  if (e.key === "Escape" && editing) cancel();
                }}
                className={`${box} ${message ? "border-danger" : "border-[#d3d1e0]"} h-[44px] pl-[44px] pr-[14px]`}
              />
            </span>
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
              <button type="button" onClick={cancel} className={`${button} border-transparent`}>
                Cancel
              </button>
            )}
          </div>
        </Field>
      ) : (
        repo && (
          <div className="flex flex-col gap-[12px]">
            <div className="flex items-center justify-between gap-[12px]">
              <RepoIdentity repo={repo} />
              <OpenOnGitHub url={repo.html_url} />
            </div>
            <RepoFiles repo={repo} />
          </div>
        )
      )}
    </FormSection>
  );
}
