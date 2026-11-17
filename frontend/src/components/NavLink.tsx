"use client";

import type { ComponentProps } from "react";
import { Link, usePathname } from "@/i18n/navigation";

type Props = Pick<ComponentProps<typeof Link>, "href" | "children" | "aria-label">;

/** A header link that marks the current page: fg + 600 and aria-current, else mute. */
export function NavLink({ href, children, "aria-label": ariaLabel }: Props) {
  const active = usePathname() === href;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={ariaLabel}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-2 text-ui transition-colors ${
        active ? "font-semibold text-fg" : "text-mute hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}
