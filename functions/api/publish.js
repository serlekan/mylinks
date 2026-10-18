import {
  guarded,
  github,
  json,
  contentPath,
  encode,
  HttpError,
} from "../lib/security.js";
import { validate, MAX_BYTES } from "../../public/schema.js";
export async function publish(context) {
  const { request, env } = context;
  if (request.method !== "POST")
    throw new HttpError(405, "Method not allowed.");
  const origin = new URL(env.PUBLIC_ORIGIN).origin;
  if (
    request.headers.get("Origin") !== origin ||
    new URL(request.url).origin !== origin ||
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  )
    throw new HttpError(403, "Same-origin publishing required.");
  if (
    !/^application\/json(?:;|$)/i.test(
      request.headers.get("Content-Type") || "",
    )
  )
    throw new HttpError(415, "JSON required.");
  const sha = request.headers.get("If-Match");
  if (!/^[a-f0-9]{40}$/.test(sha || ""))
    throw new HttpError(
      428,
      "Repository version required. Reload before publishing.",
    );
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "JSON required.");
  let size = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new HttpError(413, "Configuration exceeds 128 KiB.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of chunks) {
    bytes.set(part, offset);
    offset += part.length;
  }
  let data;
  try {
    data = validate(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
  } catch (e) {
    throw new HttpError(400, e.message);
  }
  if (data.repository !== env.GITHUB_REPOSITORY)
    throw new HttpError(403, "Publishing destination is fixed by the server.");
  const current = await github(env, `${contentPath}?ref=main`);
  if (current.sha !== sha)
    throw new HttpError(
      409,
      "Repository changed. Export your draft, reload, and reconcile before publishing.",
    );
  const content = encode(JSON.stringify(data, null, 2) + "\n");
  if (current.content.replace(/\s/g, "") === content)
    throw new HttpError(
      409,
      "This content is already committed. Check deployment instead of publishing again.",
    );
  // GitHub enforces the same SHA atomically on update; replay and concurrent writes fail.
  const result = await github(env, contentPath, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Update MyLinks profile and links",
      content,
      sha,
      branch: "main",
    }),
  });
  return json({ sha: result.content.sha, commit: result.commit.sha });
}
export const onRequestPost = (context) =>
  guarded(context, () => publish(context));
export const onRequest = (context) => guarded(context, () => publish(context));
