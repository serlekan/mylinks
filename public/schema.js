export const MAX_BYTES = 128 * 1024;
export const limits = {
  name: 100,
  eyebrow: 140,
  status: 100,
  intro: 1000,
  footer: 160,
  title: 140,
  description: 500,
  url: 2048,
};
const plain = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
function keys(x, allowed, path) {
  if (!plain(x) || Object.keys(x).some((k) => !allowed.includes(k)))
    throw Error(`${path}: unexpected fields or object type.`);
}
function str(x, max, path, required = false) {
  if (
    typeof x !== "string" ||
    x.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(x) ||
    (required && !x.trim())
  )
    throw Error(
      `${path}: ${required ? "required text, " : ""}maximum ${max} characters.`,
    );
}
export function secureUrl(value) {
  if (
    typeof value !== "string" ||
    value.length > limits.url ||
    !/^https?:\/\//i.test(value) ||
    /[\s\\]/u.test(value)
  )
    return null;
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password &&
      u.hostname
      ? u.href
      : null;
  } catch {
    return null;
  }
}
function check(d, draft = false) {
  keys(
    d,
    ["version", "profile", "repository", "links", "appearance"],
    "Configuration",
  );
  if (d.version !== 1) throw Error("Unsupported configuration version.");
  str(d.repository, 201, "Repository", true);
  if (
    !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(
      d.repository,
    )
  )
    throw Error("Repository must use owner/name format.");
  keys(d.profile, ["name", "eyebrow", "status", "intro", "footer"], "Profile");
  for (const k of ["name", "eyebrow", "status", "intro", "footer"])
    str(d.profile[k], limits[k], `Profile ${k}`, !draft && k === "name");
  if (!Array.isArray(d.links) || d.links.length > 100)
    throw Error("Links must be an array of at most 100 items.");
  const ids = new Set();
  d.links.forEach((l, i) => {
    const path = `Link ${i + 1}`;
    keys(l, ["id", "title", "description", "url", "enabled"], path);
    str(l.id, 100, `${path} ID`, true);
    if (!/^[a-zA-Z0-9_-]+$/.test(l.id) || ids.has(l.id))
      throw Error(`${path}: unique alphanumeric ID required.`);
    ids.add(l.id);
    str(l.title, limits.title, `${path} title`, !draft);
    if (l.description !== undefined)
      str(l.description, limits.description, `${path} description`);
    str(l.url, limits.url, `${path} URL`);
    if (!draft && !secureUrl(l.url))
      throw Error(
        `${path}: use an absolute HTTP(S) URL without credentials, spaces or backslashes.`,
      );
    if (typeof l.enabled !== "boolean")
      throw Error(`${path}: enabled must be true or false.`);
  });
  if (d.appearance !== undefined) {
    keys(d.appearance, ["accent", "cards"], "Appearance");
    if (
      !["lime", "mint", "sky"].includes(d.appearance.accent) ||
      !["rounded", "square"].includes(d.appearance.cards)
    )
      throw Error("Unknown appearance option.");
  }
  if (
    new TextEncoder().encode(JSON.stringify(d)).length >
    (draft ? 2 * 1024 * 1024 : MAX_BYTES)
  )
    throw Error("Configuration is too large.");
  return structuredClone(d);
}

export const validate = (data) => check(data);
export const validateDraft = (data) => check(data, true);
