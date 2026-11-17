"use client";

import { useEffect, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null; // storage blocked (private mode)
  }
}

/**
 * The token of an emailed link. `fromUrl` is the `?token=` the server read from the address; it is
 * removed from the address bar (so it is not left in history, screenshots or a Referer) and kept in
 * sessionStorage under `key`, so a reload or a detour through the login page does not lose it.
 * Returns undefined until the browser has rendered (sessionStorage is unknown on the server),
 * then the token or null.
 */
export function useLinkToken(key: string, fromUrl: string | null): string | null | undefined {
  const stored = useSyncExternalStore(noSubscribe, () => read(key), () => undefined);

  useEffect(() => {
    if (!fromUrl) return;
    try {
      window.sessionStorage.setItem(key, fromUrl);
    } catch {
      // Storage blocked: the token still works for this page view.
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [key, fromUrl]);

  if (fromUrl) return fromUrl;
  return stored;
}

export function forgetToken(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing stored or storage blocked.
  }
}
