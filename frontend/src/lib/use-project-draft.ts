"use client";

// Owns the draft being edited: what the person typed (form), what the server last answered
// (project), and how the two are kept in step.
//
// - The draft is created on the server at the first edit, exactly once.
// - Changes are saved ~800 ms after typing stops; only the changed fields are sent.
// - Every API call goes through one queue, so answers arrive in the order requests were sent
//   and an older answer can never overwrite a newer one.
// - When an answer arrives, a field takes the server's value only if the person has not typed in
//   it since the request left. That keeps newer typing and still picks up the server's clean-up
//   (trimmed text, "python" -> "Python").

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  EMPTY_FORM,
  FORM_FIELDS,
  type FormField,
  type Project,
  type ProjectForm,
  api,
  saveOnLeave,
} from "./api";

const SAVE_DELAY_MS = 800;

export type SaveState = "idle" | "saving" | "saved" | "error";
type Versions = Record<FormField, number>;

const zeroVersions = () => Object.fromEntries(FORM_FIELDS.map((f) => [f, 0])) as Versions;

function pick(form: ProjectForm, fields: Iterable<FormField>): Partial<ProjectForm> {
  const out: Record<string, unknown> = {};
  for (const field of fields) out[field] = form[field];
  return out as Partial<ProjectForm>;
}

export function useProjectDraft(draftIdFromUrl: string | null) {
  const router = useRouter();
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(draftIdFromUrl !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const idRef = useRef<string | null>(null);
  const creatingRef = useRef<Promise<string> | null>(null);
  const formRef = useRef<ProjectForm>(EMPTY_FORM);
  const versionsRef = useRef<Versions>(zeroVersions());
  const pendingRef = useRef<Set<FormField>>(new Set());
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Takes a server answer; `sent` are the field versions at the moment the request left. */
  const applyServer = useCallback((answer: Project, sent: Versions | null) => {
    setProject(answer);
    const next = { ...formRef.current };
    for (const field of FORM_FIELDS) {
      if (sent === null || versionsRef.current[field] === sent[field]) {
        (next as Record<string, unknown>)[field] = answer[field];
      }
    }
    formRef.current = next;
    setForm(next);
  }, []);

  // Open an existing draft from the address (?draft=<id>), unless it is the one we just created.
  useEffect(() => {
    if (draftIdFromUrl === null || draftIdFromUrl === idRef.current) return;
    let cancelled = false;
    api
      .getProject(draftIdFromUrl)
      .then((answer) => {
        if (cancelled) return;
        if (answer.published_at && answer.slug) {
          router.replace(`/projects/${answer.slug}`);
          return;
        }
        idRef.current = answer.id;
        applyServer(answer, null);
        setSaveState("saved");
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof ApiError ? error.message : "Could not open the draft");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [draftIdFromUrl, applyServer, router]);

  /** The draft's id; creates the draft on the first call (and only once). */
  const ensureDraft = useCallback((): Promise<string> => {
    if (idRef.current) return Promise.resolve(idRef.current);
    creatingRef.current ??= api.createProject().then((created) => {
      idRef.current = created.id;
      setProject(created);
      router.replace(`/new?draft=${created.id}`, { scroll: false });
      return created.id;
    });
    return creatingRef.current;
  }, [router]);

  /** Runs API calls one after another, in the order they were asked for. */
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(task);
    queueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  /** A queued call that answers with the project; its answer is merged into the page. */
  const send = useCallback(
    (call: (id: string) => Promise<Project>): Promise<Project> =>
      enqueue(async () => {
        const id = await ensureDraft();
        const sent = { ...versionsRef.current };
        const answer = await call(id);
        applyServer(answer, sent);
        return answer;
      }),
    [enqueue, ensureDraft, applyServer],
  );

  /** Sends the fields changed since the last save. */
  const flush = useCallback((): Promise<unknown> => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (pendingRef.current.size === 0) return queueRef.current;
    const fields = [...pendingRef.current];
    pendingRef.current.clear();
    setSaveState("saving");
    return send((id) => api.updateProject(id, pick(formRef.current, fields)))
      .then(() => {
        if (pendingRef.current.size === 0) setSaveState("saved");
        setSaveError(null);
      })
      .catch((error: unknown) => {
        for (const field of fields) pendingRef.current.add(field); // not saved: send again next time
        setSaveState("error");
        setSaveError(error instanceof ApiError ? error.message : "Could not save");
      });
  }, [send]);

  const setField = useCallback(
    <K extends FormField>(field: K, value: ProjectForm[K]) => {
      const next = { ...formRef.current, [field]: value };
      formRef.current = next;
      setForm(next);
      versionsRef.current[field] += 1;
      pendingRef.current.add(field);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  // Closing the tab: send what is not saved yet; the browser finishes the request after unload.
  useEffect(() => {
    const onLeave = () => {
      if (idRef.current && pendingRef.current.size > 0) {
        saveOnLeave(idRef.current, pick(formRef.current, pendingRef.current));
      }
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, []);

  /** Saves what is pending, then publishes. Answers the published project. */
  const publish = useCallback(async (): Promise<Project> => {
    await flush();
    return send((id) => api.publish(id));
  }, [flush, send]);

  return {
    form,
    project,
    loading,
    loadError,
    saveState,
    saveError,
    setField,
    ensureDraft,
    enqueue,
    send,
    publish,
  };
}

export type ProjectDraft = ReturnType<typeof useProjectDraft>;
