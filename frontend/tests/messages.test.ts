import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import { NAMESPACES } from "@/i18n/request";

const FIELDS = ["ai-apps", "cv-ml", "web", "mobile", "devtools", "hardware", "data"];

type Tree = { [key: string]: string | Tree };

function load(locale: string, namespace: string): Tree {
  const url = new URL(`../messages/${locale}/${namespace}.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), "utf8"));
}

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

describe("namespaces", () => {
  it("are common, projects and auth", () => {
    expect(NAMESPACES).toEqual(["common", "projects", "auth"]);
  });
});

describe.each(NAMESPACES)("namespace %s", (namespace) => {
  const en = load("en", namespace);

  it.each(["uz", "ru"])("%s has exactly the keys of en", (locale) => {
    expect(keys(load(locale, namespace))).toEqual(keys(en));
  });

  it.each(routing.locales)("%s: every value is a non-empty string", (locale) => {
    for (const value of Object.values(flatten(load(locale, namespace)))) {
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    }
  });
});

describe("common namespace", () => {
  const en = load("en", "common");

  it("has the Nav, Fields and Errors keys", () => {
    const fields = [...FIELDS, "all"].map((f) => `Fields.${f}`);
    expect(keys(en)).toEqual(
      [
        "Nav.feed",
        "Nav.language",
        "Nav.login",
        "Nav.logout",
        "Nav.settings",
        "Nav.signup",
        "Errors.notFound",
        "Errors.retry",
        "Errors.server",
        "Errors.unreachable",
        ...fields,
      ].sort(),
    );
  });

  it("writes Uzbek with the modifier letters, never an ASCII apostrophe", () => {
    for (const value of Object.values(flatten(load("uz", "common")))) {
      expect(value as string).not.toContain("'");
    }
  });
});
