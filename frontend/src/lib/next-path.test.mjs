// Run with `npm test` (Node's own test runner; Node strips the types from next-path.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNext, withNext } from "./next-path.ts";

// Every string that could send people to another site, or is empty.
const OFF_SITE = [
  "//evil.com",
  "/\\evil.com",
  "\\\\evil.com",
  "https://evil.com",
  "javascript:alert(1)",
  // browsers drop tabs and newlines inside URLs
  "/\t/evil.com",
  "/\n/evil.com",
  "/\r/evil.com",
  // "." and ".." segments that parsing removes, leaving "//evil.com" (step 2 build inspection)
  "/.//evil.com",
  "/x/..//evil.com",
  "/..//evil.com",
  "/%2e//evil.com",
  "/%2e%2e//evil.com",
  "/a/%2e%2e//evil.com",
  "/.\\/evil.com",
  "/./\\evil.com",
  "",
  null,
  undefined,
];

test("pages of this site are kept, with their query and hash", () => {
  assert.equal(safeNext("/new"), "/new");
  assert.equal(safeNext("/projects/reflex?x=1#top"), "/projects/reflex?x=1#top");
  assert.equal(safeNext("/a/../new"), "/new");
  // A relative "http:" URL is a path on this site, not another site.
  assert.equal(safeNext("http:evil.com"), "/evil.com");
});

test("anything that leaves the site, or is empty, becomes the feed", () => {
  for (const raw of OFF_SITE) assert.equal(safeNext(raw), "/", JSON.stringify(raw));
});

test("every answer is a path on this site", () => {
  const samples = [...OFF_SITE, "/x/../..//a.com/b", "/%2F/evil.com", "/ ", "/é", "/" + "a".repeat(5000)];
  for (const raw of samples) {
    const out = safeNext(raw);
    assert.ok(out.startsWith("/") && !out.startsWith("//"), JSON.stringify(raw));
    assert.equal(new URL(out, "http://x").origin, "http://x", JSON.stringify(raw));
  }
});

test("links to the other form keep next, and drop it when it is the feed", () => {
  assert.equal(withNext("/login", "/new"), "/login?next=%2Fnew");
  assert.equal(withNext("/signup", "/"), "/signup");
});
