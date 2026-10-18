import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { validate, secureUrl } from "../public/schema.js";
const root = new URL("../public/", import.meta.url);
const source = () =>
  JSON.parse(readFileSync(new URL("data.json", root), "utf8"));
test("published content follows shared schema", () =>
  assert.deepEqual(validate(source()), source()));
for (const url of [
  "javascript:alert(1)",
  "data:text/html,hi",
  "file:///C:/x",
  "https://name:secret@example.com",
  " https://example.com",
  "https:\\example.com",
  "https://example.com/ space",
  "//example.com",
  "http://",
])
  test(`reject unsafe URL ${url}`, () => assert.equal(secureUrl(url), null));
for (const url of [
  "https://example.com/path?q=x#anchor",
  "http://example.com",
  "https://例え.jp/",
])
  test(`allow HTTP(S) ${url}`, () => assert.ok(secureUrl(url)));
const invalids = {
  version: (d) => (d.version = 2),
  duplicate: (d) => d.links.push(d.links[0]),
  empty: (d) => (d.links[0].title = " "),
  type: (d) => (d.profile.intro = {}),
  length: (d) => (d.links[0].description = "x".repeat(501)),
  enabled: (d) => (d.links[0].enabled = "true"),
  unknown: (d) => (d.token = "secret"),
  nested: (d) => (d.links[0].html = "<img>"),
  appearance: (d) => (d.appearance = { accent: "url(evil)", cards: "rounded" }),
  prototype: (d) => (d.links[0].id = "__proto__!"),
};
for (const [name, mutate] of Object.entries(invalids))
  test(`schema rejects ${name}`, () => {
    const d = source();
    mutate(d);
    assert.throws(() => validate(d));
  });
test("scripts parse on Windows and POSIX", () => {
  for (const script of ["app.js", "editor.js", "schema.js", "render.js"]) {
    const p = spawnSync(
      process.execPath,
      ["--check", fileURLToPath(new URL(script, root))],
      { encoding: "utf8" },
    );
    assert.equal(p.status, 0, p.stderr);
  }
});
test("public assets exist", () => {
  for (const f of [
    "index.html",
    "editor.html",
    "styles.css",
    "_headers",
    "_routes.json",
    "robots.txt",
  ])
    assert.ok(existsSync(new URL(f, root)), f);
});
