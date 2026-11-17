import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)));

describe("design tokens", () => {
  it("src/app/tokens.css is a byte-identical copy of docs/design/tokens.css", () => {
    const copy = read("../src/app/tokens.css");
    const source = read("../../docs/design/tokens.css");
    expect(copy.equals(source)).toBe(true);
  });
});
