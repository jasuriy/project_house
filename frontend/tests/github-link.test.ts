import { describe, expect, it } from "vitest";
import { sameRepository } from "@/lib/github-link";

// Mirrors backend app/projects/github.py parse_github_url / same_repository.
describe("sameRepository", () => {
  it.each([
    ["https://github.com/octocat/Hello-World", "github.com/OCTOCAT/hello-world.git", true],
    ["https://github.com/octocat/Hello-World", "https://www.github.com/octocat/Hello-World/tree/main", true],
    ["https://github.com/octocat/Hello-World", "https://github.com/octocat/Spoon-Knife", false],
    ["https://github.com/octocat/Hello-World", "https://gitlab.com/octocat/Hello-World", false],
    ["", "https://github.com/octocat/Hello-World", false],
    [null, null, false],
  ])("%s vs %s -> %s", (a, b, same) => {
    expect(sameRepository(a, b)).toBe(same);
  });
});
