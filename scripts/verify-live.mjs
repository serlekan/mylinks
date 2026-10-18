import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validate } from "../public/schema.js";
const expected = process.env.GITHUB_SHA;
if (!/^[a-f0-9]{40}$/.test(expected || ""))
  throw Error("GITHUB_SHA must identify the release commit.");
const content = validate(
  JSON.parse(await readFile("public/data.json", "utf8")),
);
for (const origin of [
  ...new Set(
    [process.env.DEPLOYMENT_URL, "https://serlekan-links.pages.dev"].filter(
      Boolean,
    ),
  ),
]) {
  let error;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const get = async (path) => {
        const r = await fetch(new URL(path, origin), {
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        assert.equal(r.status, 200, `${path} HTTP ${r.status}`);
        return r;
      };
      assert.equal(
        (await (await get(`/release.json?v=${expected}`)).json()).commit,
        expected,
      );
      assert.deepEqual(
        validate(await (await get(`/data.json?v=${expected}`)).json()),
        content,
      );
      const html = await (await get("/")).text();
      assert.ok(html.includes('type="module"'));
      assert.ok(html.includes("og:title"));
      for (const path of [
        "/app.js",
        "/schema.js",
        "/render.js",
        "/styles.css",
        "/editor.js",
      ])
        assert.ok((await (await get(path)).text()).length > 20);
      const editor = await fetch(new URL("/editor.html", origin), {
        redirect: "manual",
      });
      assert.ok([200, 302, 401, 403, 503].includes(editor.status));
      const denied = await fetch(new URL("/api/publish", origin), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert.ok(
        [401, 403, 503].includes(denied.status),
        "Anonymous publishing must fail closed",
      );
      assert.ok(
        denied.headers.get("content-type")?.includes("application/json"),
        "Must be owner service denial, not SPA fallback",
      );
      console.log(
        `Verified ${origin}: release ${expected.slice(0, 12)}, content/assets and anonymous write denial.`,
      );
      error = null;
      break;
    } catch (e) {
      error = e;
      if (attempt < 11) await new Promise((r) => setTimeout(r, 5000));
    }
  }
  if (error) throw error;
}
