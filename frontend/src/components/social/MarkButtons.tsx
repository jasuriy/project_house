"use client";

import { Bookmark, Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type ReactNode } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { clientDelete, clientPut } from "@/lib/client-api";

// Mockup screen 2b: bordered buttons under the author; full width halves on a phone.
const BUTTON =
  "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-control border bg-card px-4 text-ui font-semibold tabular-nums md:h-10 md:flex-none";

/**
 * A like or a save: the screen changes at once and goes back if the call fails. A second click
 * while the first call runs is ignored, so the screen and the server stay in step.
 */
function useMark(path: string, initial: boolean) {
  const [on, setOn] = useState(initial);
  const busy = useRef(false);
  const router = useRouter();

  async function toggle(onChange?: (next: boolean) => void) {
    if (busy.current) return;
    busy.current = true;
    const next = !on;
    setOn(next);
    onChange?.(next);
    const result = next ? await clientPut(path) : await clientDelete(path);
    if (!result.ok) {
      setOn(!next);
      onChange?.(!next);
    } else {
      // Drop the pages the browser kept: Back to Saqlanganlar must not show what was just unsaved.
      router.refresh();
    }
    busy.current = false;
  }

  return { on, toggle };
}

/** Logged out, the button is a link to login that comes back to this page. */
function Shell({
  loginHref,
  pressed,
  onClick,
  label,
  className,
  children,
}: {
  loginHref: string | null;
  /** Omitted for a button whose own words say its state (Saqlash / Saqlangan). */
  pressed?: boolean;
  onClick: () => void;
  label?: string;
  className: string;
  children: ReactNode;
}) {
  if (loginHref !== null) {
    return (
      <Link href={loginHref} aria-label={label} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" aria-pressed={pressed} aria-label={label} onClick={onClick} className={className}>
      {children}
    </button>
  );
}

export function LikeButton({
  projectId,
  liked,
  count,
  loginHref,
}: {
  projectId: number;
  liked: boolean;
  count: number;
  loginHref: string | null;
}) {
  const t = useTranslations("Social");
  const { on, toggle } = useMark(`/api/v1/me/likes/${projectId}`, liked);
  const [shown, setShown] = useState(count);

  return (
    <Shell
      loginHref={loginHref}
      pressed={on}
      onClick={() => toggle((next) => setShown((n) => n + (next ? 1 : -1)))}
      label={t("like", { count: shown })}
      className={`${BUTTON} ${on ? "border-border text-danger hover:border-danger" : "border-border text-fg hover:border-primary"}`}
    >
      <Heart aria-hidden className={`size-4.5 ${on ? "fill-current" : ""}`} />
      {shown}
    </Shell>
  );
}

export function SaveButton({
  projectId,
  saved,
  loginHref,
}: {
  projectId: number;
  saved: boolean;
  loginHref: string | null;
}) {
  const t = useTranslations("Social");
  const { on, toggle } = useMark(`/api/v1/me/saves/${projectId}`, saved);

  return (
    <Shell
      loginHref={loginHref}
      onClick={() => toggle()}
      className={`${BUTTON} ${on ? "border-primary text-primary" : "border-border text-fg hover:border-primary"}`}
    >
      {/* The words carry the state, so no aria-pressed (it would be read twice). */}
      <Bookmark aria-hidden className={`size-4.5 ${on ? "fill-current" : ""}`} />
      {on ? t("saved") : t("save")}
    </Shell>
  );
}
