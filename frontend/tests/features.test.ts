import { afterEach, describe, expect, it, vi } from "vitest";

// The deployment builds with NEXT_PUBLIC_EMAIL_LOGIN=false (GitHub sign-in only); locally it is
// unset and email sign-in stays on.
async function emailLogin(): Promise<boolean> {
  vi.resetModules();
  return (await import("@/lib/features")).EMAIL_LOGIN;
}

afterEach(() => vi.unstubAllEnvs());

describe("EMAIL_LOGIN", () => {
  it("is on when the flag is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_LOGIN", undefined);
    expect(await emailLogin()).toBe(true);
  });

  it("is off only for the exact value false", async () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_LOGIN", "false");
    expect(await emailLogin()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_EMAIL_LOGIN", "true");
    expect(await emailLogin()).toBe(true);
  });
});
