"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Popover } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { Avatar } from "./avatar";

/**
 * The avatar in the header and its menu: who is logged in, then Log out. The menu is the shared
 * Popover (Escape and a click outside close it; focus returns to the avatar).
 */
export function AccountMenu({ name, username, avatarUrl }: { name: string; username: string; avatarUrl: string | null }) {
  const [leaving, setLeaving] = useState(false);
  const [open, setOpen] = useState(false);

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
      open={open}
      onOpenChange={setOpen}
      trigger={({ toggle, panelId }) => (
        <button
          type="button"
          aria-label="Account menu"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className="group ml-[4px] inline-flex h-[40px] w-[40px] items-center justify-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-primary"
        >
          <Avatar
            name={name}
            src={avatarUrl}
            size={36}
            className={`transition-shadow ${
              open ? "shadow-[0_0_0_2px_var(--color-card),0_0_0_4px_#cfcbf6]" : "group-hover:shadow-[0_0_0_2px_var(--color-card),0_0_0_4px_var(--color-line)]"
            }`}
          />
        </button>
      )}
    >
      {/* Your profile: the name block itself is the link (no separate "Your profile" item). It closes
          the menu, so it is not still open when Back returns to this page. */}
      <div className="mb-[8px] border-b border-line pb-[8px]">
        <Link
          href={`/u/${username}`}
          onClick={() => setOpen(false)}
          className="block rounded-[8px] px-[10px] pb-[4px] outline-none hover:bg-page focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-primary"
        >
          <span className="block text-body font-semibold [overflow-wrap:anywhere]">{name}</span>
          <span className="block text-cap text-muted [overflow-wrap:anywhere]">@{username}</span>
        </Link>
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
