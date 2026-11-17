import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";

describe("routing", () => {
  it("supports uz, ru and en in that order", () => {
    expect(routing.locales).toEqual(["uz", "ru", "en"]);
  });

  it("defaults to uz", () => {
    expect(routing.defaultLocale).toBe("uz");
  });
});
