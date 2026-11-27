"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Popover } from "@/components/ui/popover";
import { api } from "@/lib/api";

/**
 * The avatar in the header and its menu: who is logged in, then Log out. The menu is the shared
 * Popover (Escape and a click outside close it; focus returns to the avatar).
 */
export function AccountMenu({ name, username, avatarUrl }: { name: string; username: string; avatarUrl: string | null }) {
  const [leaving, setLeaving] = useState(false);

  const logOut = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await api.logOut();
    } catch {
      // Not logged out (no answer): the reload below shows that truthfully.
    }
    // A full load: the header is drawn on the server and must show the real state.
    window.location.reload();
  };

  return (
    <Popover
      label="Account menu"
      align="right"
      width={240}
      trigger={({ open, toggle, panelId }) => (
        <button
          type="button"
          aria-label="Account menu"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className="group ml-[4px] inline-flex h-[40px] w-[40px] items-center justify-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-primary"
        >
          <span
            aria-hidden="true"
            className={`inline-flex h-[36px] w-[36px] items-center justify-center overflow-hidden rounded-full bg-badge text-body font-semibold text-primary-ink transition-shadow ${
              open ? "shadow-[0_0_0_2px_var(--color-card),0_0_0_4px_#cfcbf6]" : "group-hover:shadow-[0_0_0_2px_var(--color-card),0_0_0_4px_var(--color-line)]"
            }`}
          >
            {avatarUrl ? (
              // A GitHub photo (step 4); a plain img, since the address is on GitHub's servers.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              Array.from(name.trim())[0]?.toUpperCase() // a whole character, even an emoji
            )}
          </span>
        </button>
      )}
    >
      <div className="mb-[8px] border-b border-line px-[10px] pb-[12px]">
        <p className="text-body font-semibold [overflow-wrap:anywhere]">{name}</p>
        <p className="text-cap text-muted [overflow-wrap:anywhere]">@{username}</p>
      </div>
      <button
        type="button"
        onClick={logOut}
        aria-disabled={leaving || undefined}
        className="flex h-[36px] w-full items-center gap-[10px] rounded-[8px] px-[10px] text-left text-body text-ink-2 outline-none hover:bg-page focus-visible:bg-page focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-primary"
      >
        <LogOut size={16} strokeWidth={2} aria-hidden="true" className="text-muted" />
        Log out
      </button>
    </Popover>
  );
}
