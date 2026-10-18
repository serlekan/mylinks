import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validate, validateDraft } from "../public/schema.js";
const original = () => JSON.parse(readFileSync("public/data.json", "utf8"));
test("incomplete drafts preserve bounded text but cannot publish", () => {
  const d = original();
  d.profile.name = " ";
  d.links[0].title = "";
  d.links[0].url = "https://";
  assert.deepEqual(validateDraft(d), d);
  assert.throws(() => validate(d));
});
test("large drafts remain recoverable above publish size", () => {
  const d = original();
  d.links = Array.from({ length: 100 }, (_, i) => ({
    id: `id-${i}`,
    title: "Link",
    description: "x".repeat(500),
    url: "https://example.com/" + "x".repeat(1800),
    enabled: false,
  }));
  assert.ok(JSON.stringify(d).length > 131072);
  assert.deepEqual(validateDraft(d), d);
  assert.throws(() => validate(d));
});
