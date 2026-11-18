import { describe, expect, it } from "vitest";
import { isUsername, profileLinks } from "@/lib/profile";

describe("profileLinks", () => {
  it.each([
    [{ github: "https://github.com/aziz" }, [["github", "aziz"]]],
    [{ linkedin: "https://www.linkedin.com/in/aziz" }, [["linkedin", "LinkedIn"]]],
    [{ website: "https://www.aziz.dev/x" }, [["website", "aziz.dev"]]],
    [{ website: "javascript:alert(1)" }, []],
    [{ telegram: "https://t.me/aziz" }, []],
    [{ github: 42 }, []],
  ])("%o", (links, expected) => {
    expect(profileLinks(links).map((link) => [link.key, link.label])).toEqual(expected);
  });
});

describe("isUsername", () => {
  it.each([
    ["aziz-rahimov", true],
    ["robots.txt", false],
    ["Aziz", false],
  ])("%s -> %s", (name, ok) => {
    expect(isUsername(name)).toBe(ok);
  });
});
