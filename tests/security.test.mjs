import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT } from "jose";
import { authorize, HttpError } from "../functions/lib/security.js";
import { publish } from "../functions/api/publish.js";
import { readFileSync } from "node:fs";
const env = {
  ACCESS_TEAM: "test-team",
  ACCESS_AUD: "owner-app",
  OWNER_EMAILS: "owner@example.com",
  GITHUB_TOKEN: "test-only",
  GITHUB_REPOSITORY: "serlekan/mylinks",
  PUBLIC_ORIGIN: "https://serlekan-links.pages.dev",
};
const { privateKey, publicKey } = await generateKeyPair("RS256");
const jwt = async (overrides = {}, key = privateKey) =>
  new SignJWT({ email: "owner@example.com", ...overrides })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer("https://test-team.cloudflareaccess.com")
    .setAudience("owner-app")
    .setSubject("owner")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
const request = (token) =>
  new Request(env.PUBLIC_ORIGIN + "/api/publish", {
    headers: { "Cf-Access-Jwt-Assertion": token },
  });
test("missing server configuration denies access", async () =>
  assert.rejects(authorize(request("forged"), {}), (e) => e.status === 503));
test("missing assertion denies access", async () =>
  assert.rejects(
    authorize(new Request(env.PUBLIC_ORIGIN), env),
    (e) => e.status === 401,
  ));
test("verified owner JWT accepted", async () =>
  assert.equal(
    (await authorize(request(await jwt()), env, publicKey)).email,
    "owner@example.com",
  ));
test("verified nonowner JWT denied", async () =>
  assert.rejects(
    authorize(
      request(await jwt({ email: "visitor@example.com" })),
      env,
      publicKey,
    ),
    (e) => e.status === 403,
  ));
test("forged signature denied", async () => {
  const other = await generateKeyPair("RS256");
  await assert.rejects(
    authorize(request(await jwt({}, other.privateKey)), env, publicKey),
    (e) => e.status === 403,
  );
});
test("expired JWT denied", async () => {
  const token = await new SignJWT({ email: "owner@example.com" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer("https://test-team.cloudflareaccess.com")
    .setAudience("owner-app")
    .setSubject("owner")
    .setIssuedAt(1)
    .setExpirationTime(2)
    .sign(privateKey);
  await assert.rejects(authorize(request(token), env, publicKey));
});
test("wrong audience denied", async () => {
  const token = await new SignJWT({ email: "owner@example.com" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer("https://test-team.cloudflareaccess.com")
    .setAudience("different-app")
    .setSubject("owner")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  await assert.rejects(authorize(request(token), env, publicKey));
});
const data = JSON.parse(readFileSync("public/data.json", "utf8"));
const ctx = (headers = {}, body = JSON.stringify(data)) => ({
  env,
  request: new Request(env.PUBLIC_ORIGIN + "/api/publish", {
    method: "POST",
    headers: {
      Origin: env.PUBLIC_ORIGIN,
      "Content-Type": "application/json",
      "If-Match": "a".repeat(40),
      ...headers,
    },
    body,
  }),
});
test("cross-origin POST denied before GitHub", async () =>
  assert.rejects(
    publish(ctx({ Origin: "https://attacker.example" })),
    (e) => e.status === 403,
  ));
test("version precondition required", async () =>
  assert.rejects(publish(ctx({ "If-Match": "" })), (e) => e.status === 428));
test("malformed import denied", async () =>
  assert.rejects(publish(ctx({}, "{")), (e) => e.status === 400));
test("request body limited", async () =>
  assert.rejects(
    publish(ctx({}, "x".repeat(131073))),
    (e) => e.status === 413,
  ));
test("client cannot change repository", async () =>
  assert.rejects(
    publish(ctx({}, JSON.stringify({ ...data, repository: "attacker/repo" }))),
    (e) => e.status === 403,
  ));
test("stale SHA never writes and replay fails", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ sha: "b".repeat(40), content: "" });
  };
  try {
    await assert.rejects(publish(ctx()), (e) => e.status === 409);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("successful write pins branch path and SHA", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.ok(
      url.startsWith(
        "https://api.github.com/repos/serlekan/mylinks/contents/public/data.json",
      ),
    );
    if (calls === 1) return Response.json({ sha: "a".repeat(40), content: "" });
    const body = JSON.parse(init.body);
    assert.equal(body.sha, "a".repeat(40));
    assert.equal(body.branch, "main");
    return Response.json({
      content: { sha: "b".repeat(40) },
      commit: { sha: "c".repeat(40) },
    });
  };
  try {
    const result = await publish(ctx());
    assert.equal((await result.json()).commit, "c".repeat(40));
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
