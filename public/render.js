import { secureUrl } from "./schema.js";
const el = (doc, tag, cls, text) => {
  const n = doc.createElement(tag);
  n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
// Public and preview share this renderer. User content is always inserted as text.
export function render(data, doc = document) {
  const $ = (id) => doc.getElementById(id);
  const p = data.profile;
  for (const [id, text] of Object.entries({
    name: `${p.name}.`,
    brand: `${p.name} / Link Hub`,
    "footer-name": p.name,
    eyebrow: p.eyebrow,
    status: p.status,
    intro: p.intro,
    "footer-note": p.footer,
    year: new Date().getFullYear(),
  }))
    $(id).textContent = text;
  doc.title = `${p.name} — Links`;
  doc.documentElement.dataset.accent = data.appearance?.accent || "lime";
  doc.documentElement.dataset.cards = data.appearance?.cards || "rounded";
  const nav = $("links");
  nav.replaceChildren();
  for (const link of data.links) {
    if (!link.enabled) continue;
    const a = el(doc, "a", "card");
    const url = secureUrl(link.url);
    if (url) {
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    } else a.setAttribute("aria-disabled", "true");
    const copy = el(doc, "div", "card-copy");
    copy.append(
      el(doc, "h2", "", link.title || "Untitled link"),
      el(doc, "p", "", link.description || ""),
    );
    const arrow = el(doc, "span", "arrow", "↗");
    arrow.setAttribute("aria-hidden", "true");
    a.append(
      el(doc, "span", "num", String(nav.children.length + 1).padStart(2, "0")),
      copy,
      arrow,
    );
    nav.append(a);
  }
  $("notice").hidden = nav.children.length > 0;
  $("notice").textContent = "No links are published yet.";
  nav.setAttribute("aria-busy", "false");
}
