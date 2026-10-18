import { createRemoteJWKSet, jwtVerify } from "jose";
const keysets = new Map();
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function configured(env) {
  return Boolean(
    env.ACCESS_TEAM &&
      /^[a-z0-9-]+$/.test(env.ACCESS_TEAM) &&
      env.ACCESS_AUD &&
      env.OWNER_EMAILS &&
      env.GITHUB_TOKEN &&
      env.GITHUB_REPOSITORY &&
      env.PUBLIC_ORIGIN,
  );
}
export async function authorize(request, env, keyset) {
  if (!configured(env))
    throw new HttpError(
      503,
      "Owner publishing is not configured. Use JSON export and commit.",
    );
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!assertion || assertion.length > 16384)
    throw new HttpError(
      401,
      "Owner authentication required. Sign in through Cloudflare Access.",
    );
  const issuer = `https://${env.ACCESS_TEAM}.cloudflareaccess.com`;
  if (!keysets.has(issuer))
    keysets.set(
      issuer,
      createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)),
    );
  try {
    const { payload } = await jwtVerify(
      assertion,
      keyset || keysets.get(issuer),
      {
        issuer,
        audience: env.ACCESS_AUD,
        algorithms: ["RS256"],
        requiredClaims: ["exp", "iat", "sub", "email"],
        clockTolerance: 5,
      },
    );
    const allowed = env.OWNER_EMAILS.split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    if (
      typeof payload.email !== "string" ||
      !allowed.includes(payload.email.toLowerCase()) ||
      payload.iat > Date.now() / 1000 + 5
    )
      throw Error("Owner denied");
    return payload;
  } catch {
    throw new HttpError(403, "Owner authorization denied.");
  }
}
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    },
  });
}
export async function guarded(context, action) {
  try {
    await authorize(context.request, context.env);
    return await action();
  } catch (e) {
    return json(
      {
        error:
          e instanceof HttpError
            ? e.message
            : "Owner service failed. Your draft is preserved.",
      },
      e instanceof HttpError ? e.status : 502,
    );
  }
}
export async function github(env, path, init = {}) {
  if (
    !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(
      env.GITHUB_REPOSITORY,
    )
  )
    throw new HttpError(503, "Invalid server repository configuration.");
  const r = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/${path}`,
    {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "User-Agent": "MyLinks-owner-service",
        "X-GitHub-Api-Version": "2026-03-10",
        ...init.headers,
      },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!r.ok)
    throw new HttpError(
      [409, 422].includes(r.status) ? 409 : 502,
      [409, 422].includes(r.status)
        ? "Repository changed. Export your draft, reload, and reconcile before publishing."
        : "GitHub request failed. Check server credential permissions and retry.",
    );
  return r.json();
}
export const contentPath = "contents/public/data.json";
export const encode = (text) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};
export const decode = (text) =>
  new TextDecoder("utf-8", { fatal: true }).decode(
    Uint8Array.from(atob(text.replace(/\s/g, "")), (c) => c.charCodeAt(0)),
  );
