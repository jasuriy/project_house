"use client";

// Owns everything on the upload page until Render: what the person typed, the uploaded video
// (waiting in R2's temporary folder) and the repository preview. Nothing is stored on the server
// before Render (Bek, 2026-11-24), so leaving the page in any way starts over with an empty form:
// - F5 or closing the tab: browser memory is gone, nothing to clean up here;
// - moving to another page of the site: Next.js keeps the page hidden (Activity) and would show
//   the old form on return, so the state is reset when the page is hidden.
// The temporary files of an abandoned form are removed by the bucket's lifecycle rule.

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ApiError, type Catalog, EMPTY_FORM, type FormField, type Project, type ProjectForm, type RepoSnapshot, api } from "./api";

export type UploadedVideo = {
  key: string;
  posterKey: string | null;
  fileName: string;
  size: number;
  duration: number | null;
  // Preview from the person's own file (object URLs): no download from R2 is needed.
  previewUrl: string;
  posterPreviewUrl: string | null;
};
export type LinkedRepo = { url: string; snapshot: RepoSnapshot };

/** Same rule as the server: trimmed empty text, an empty list or no value counts as missing. */
function isBlank(value: unknown): boolean {
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return value === null || value === undefined;
}

export function missingFields(catalog: Catalog, form: ProjectForm, video: UploadedVideo | null): Set<string> {
  return new Set(
    catalog.required_fields.filter((field) => (field === "video" ? !video : isBlank(form[field as FormField]))),
  );
}

/** The linked repository's address as shown in the box (without https://). */
export const linkedRepoText = (repo: LinkedRepo | null) => repo?.snapshot.html_url.replace(/^https?:\/\//, "") ?? "";

/**
 * The repository is optional (D25), but a link that is typed and not connected yet (or still
 * being checked) must not be dropped silently on Render.
 */
export function repoPending(state: ProjectFormState): boolean {
  if (state.repoLinking) return true;
  const typed = state.repoText?.trim() ?? "";
  return typed !== "" && typed !== linkedRepoText(state.repo);
}

/** The server's two date rules, shown while typing (the server checks them again on Render). */
export function dateError(form: ProjectForm): string | null {
  if (form.ongoing && form.finished_on) return "An ongoing project has no finish date";
  if (form.started_on && form.finished_on && form.finished_on < form.started_on) {
    return "The finish date is before the start date";
  }
  return null;
}

function revoke(video: UploadedVideo | null) {
  if (!video) return;
  URL.revokeObjectURL(video.previewUrl);
  if (video.posterPreviewUrl) URL.revokeObjectURL(video.posterPreviewUrl);
}

export function useProjectForm() {
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);
  const [video, setVideoState] = useState<UploadedVideo | null>(null);
  const [repo, setRepo] = useState<LinkedRepo | null>(null);
  // What is typed in the repository box; null shows the linked repository instead.
  const [repoText, setRepoText] = useState<string | null>(null);
  const [repoLinking, setRepoLinking] = useState(false);
  const videoRef = useRef<UploadedVideo | null>(null);
  // A ref, not state: a second click must be refused before React re-renders the button.
  const submittingRef = useRef(false);

  const setField = useCallback(<K extends FormField>(field: K, value: ProjectForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const setVideo = useCallback((next: UploadedVideo | null) => {
    revoke(videoRef.current);
    videoRef.current = next;
    setVideoState(next);
  }, []);

  const reset = useCallback(() => {
    submittingRef.current = false;
    setForm(EMPTY_FORM);
    setVideo(null);
    setRepo(null);
    setRepoText(null);
    setRepoLinking(false);
  }, [setVideo]);

  // Runs when the page is hidden (another page of the site opened, including the new project's
  // page after Render) and on unmount.
  useLayoutEffect(() => reset, [reset]);

  /**
   * Render: sends everything in one request. After success the lock stays on until the page is
   * left (reset), so the same form cannot create a second project.
   */
  const submit = useCallback(async (): Promise<Project> => {
    if (submittingRef.current) throw new ApiError(409, "busy", "Already rendering");
    submittingRef.current = true;
    try {
      return await api.createProject({
        ...form,
        video: video && { key: video.key, file_name: video.fileName, duration_seconds: video.duration },
        poster_key: video?.posterKey ?? null,
        repo_url: repo?.url ?? null,
      });
    } catch (error) {
      submittingRef.current = false; // nothing was created: the person may fix and try again
      throw error;
    }
  }, [form, video, repo]);

  return { form, video, repo, repoText, repoLinking, setField, setVideo, setRepo, setRepoText, setRepoLinking, submit };
}

export type ProjectFormState = ReturnType<typeof useProjectForm>;
