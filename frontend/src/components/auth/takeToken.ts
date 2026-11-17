"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

const noSubscribe = () => () => {};

/** sessionStorage keys of the emailed-link tokens; logout clears them. */
export const LINK_TOKEN_KEYS = ["ph_reset_token", "ph_verify_token"] as const;

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null; // storage blocked
  }
}

/**
 * The token of an emailed link. `fromUrl` is the `?token=` the server read from the address. It is
 * kept in sessionStorage under `key` (so a reload, a language switch or the login detour does not
 * lose it) and removed from the address through the router: a raw history.replaceState left the
 * token in the router's own copy of the URL, and the next router action (a language switch) put it
 * back into the address bar and the server request. Returns undefined until the browser has
 * rendered (sessionStorage is unknown on the server), then the token or null.
 */
export function useLinkToken(key: string, fromUrl: string | null): string | null | undefined {
  const router = useRouter();
  const pathname = usePathname();
  const stored = useSyncExternalStore(noSubscribe, () => read(key), () => undefined);

  useEffect(() => {
    if (!fromUrl) return;
    try {
      window.sessionStorage.setItem(key, fromUrl);
    } catch {
      // Storage blocked: the token still works for this page view.
    }
    router.replace(pathname, { scroll: false });
  }, [key, fromUrl, pathname, router]);

  return fromUrl ?? stored;
}

export function forgetToken(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing stored or storage blocked.
  }
}
