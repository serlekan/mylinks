import { authorize, json } from "./lib/security.js";
export async function onRequest(context) {
  const path = new URL(context.request.url).pathname;
  if (path.startsWith("/api/")) return context.next();
  // Static fallback editor remains usable without Access. If any Access setting is present, fail closed.
  if (
    /^\/editor(?:\.html)?\/?$/.test(path) &&
    (context.env.ACCESS_TEAM || context.env.ACCESS_AUD)
  ) {
    try {
      await authorize(context.request, context.env);
    } catch (e) {
      return json({ error: e.message }, e.status || 403);
    }
  }
  return context.next();
}
