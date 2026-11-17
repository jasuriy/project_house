import { describe, expect, it } from "vitest";
import { verifyOutcome } from "@/lib/verify-outcome";

describe("verifyOutcome", () => {
  it.each([
    [{ ok: true as const }, "confirmed"],
    [{ ok: false as const, status: 401 }, "login"],
    [{ ok: false as const, status: 400 }, "invalid"],
    [{ ok: false as const, status: 0 }, "retry"],
    [{ ok: false as const, status: 500 }, "retry"],
    [{ ok: false as const, status: 403 }, "retry"],
  ])("%o -> %s", (result, outcome) => {
    expect(verifyOutcome(result)).toBe(outcome);
  });
});
