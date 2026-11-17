import { describe, expect, it } from "vitest";
import uz from "../messages/uz.json";
import ru from "../messages/ru.json";
import en from "../messages/en.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      Object.assign(out, flatten(value, path));
    } else {
      out[path] = value;
    }
  }
  return out;
}

const keys = (tree: Tree) => Object.keys(flatten(tree)).sort();

describe("message catalogues", () => {
  it("uz has exactly the keys of en", () => {
    expect(keys(uz)).toEqual(keys(en));
  });

  it("ru has exactly the keys of en", () => {
    expect(keys(ru)).toEqual(keys(en));
  });

  it("contains the required keys", () => {
    expect(keys(en)).toEqual([
      "Home.backendStatus",
      "Home.subtitle",
      "Home.title",
      "Status.degraded",
      "Status.ok",
      "Status.unreachable",
    ]);
  });

  it.each([
    ["uz", uz],
    ["ru", ru],
    ["en", en],
  ])("%s: every value is a non-empty string", (_name, tree) => {
    for (const value of Object.values(flatten(tree))) {
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    }
  });
});
