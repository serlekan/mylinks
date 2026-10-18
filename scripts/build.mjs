import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { validate } from "../public/schema.js";
const data = validate(JSON.parse(await readFile("public/data.json", "utf8")));
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let html = await readFile("public/index.html", "utf8");
const p = data.profile;
html = html.replace(
  /<title>.*?<\/title>/,
  () => `<title>${escape(p.name)} — Links</title>`,
);
for (const [id, text] of Object.entries({
  name: p.name + ".",
  brand: p.name + " / Link Hub",
  "footer-name": p.name,
  eyebrow: p.eyebrow,
  status: p.status,
  intro: p.intro,
  "footer-note": p.footer,
  year: new Date().getFullYear(),
}))
  html = html.replace(
    new RegExp(`(<(?:span|div|h1|p)[^>]*id="${id}"[^>]*>)[^<]*`),
    (_, open) => open + escape(text),
  );
const cards = data.links
  .filter((l) => l.enabled)
  .map(
    (l, i) =>
      `<a class="card" href="${escape(l.url)}" target="_blank" rel="noopener noreferrer"><span class="num">${String(i + 1).padStart(2, "0")}</span><div class="card-copy"><h2>${escape(l.title)}</h2><p>${escape(l.description || "")}</p></div><span class="arrow" aria-hidden="true">↗</span></a>`,
  )
  .join("\n");
html = html
  .replace(
    /(<nav\b[^>]*\bclass="links"[^>]*>)[\s\S]*?<\/nav>/,
    (_, open) => open + cards + "</nav>",
  )
  .replace('aria-busy="true"', 'aria-busy="false"');
html = html.replace(
  '<html lang="en">',
  () =>
    `<html lang="en" data-accent="${data.appearance?.accent || "lime"}" data-cards="${data.appearance?.cards || "rounded"}">`,
);
html = html.replace(
  'content="Links to my work, projects and social profiles."',
  () => `content="${escape(p.intro)}"`,
);
html = html.replace(
  "</head>",
  () =>
    `<link rel="canonical" href="https://serlekan-links.pages.dev/"><meta property="og:title" content="${escape(p.name)} — Links"><meta property="og:description" content="${escape(p.intro)}"><meta property="og:type" content="website"><meta property="og:url" content="https://serlekan-links.pages.dev/"><meta name="twitter:card" content="summary"><meta property="og:image" content="https://serlekan-links.pages.dev/social.png"></head>`,
);
await writeFile("dist/index.html", html);
await writeFile(
  "dist/release.json",
  JSON.stringify({
    commit: process.env.GITHUB_SHA || "local",
    builtAt: new Date().toISOString(),
  }) + "\n",
);
console.log("Built static fallback, metadata and release marker.");
