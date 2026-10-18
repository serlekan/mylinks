# MyLinks

A small, open-source link hub with the Serlekan dark/lime design, visual editor, real page preview, local drafts, JSON portability, and optional owner-authenticated publishing. MIT licensed. No framework or database.

[Public site](https://serlekan-links.pages.dev/) · [Editor](https://serlekan-links.pages.dev/editor.html)

## Content and editing

`public/data.json` is the authoritative published source. Editing, importing, previewing, and saving drafts do not change it. A deployment updates the public website.

The editor has Profile, Links, Appearance, Preview, and Save & publish sections. Add/edit links, toggle visibility, drag by the handle or use Move up/down, remove with confirmation, change profile/footer, and preview at desktop/mobile widths. The iframe runs the same HTML, CSS, modules, and renderer as the public page. Invalid draft destinations have no active link.

Save draft preserves incomplete fields in this browser's local storage; Restore draft retrieves them after reload. Drafts are scoped to the repository and are not shared between browsers or devices. Unsaved changes trigger a navigation warning. Browser storage can fail (private mode/quota); the editor reports this. Download data.json requires valid content. Import validates the entire configuration before replacing anything and confirms replacing unsaved work. Restore published version fetches fresh deployed data after confirmation and retains your saved draft.

For manual publishing, download data.json, compare it with the latest `public/data.json` on main, reconcile concurrent changes, replace that file and commit. Wait for a verified successful deployment. A commit alone does not update a Direct Upload site. Never put credentials in JSON.

## Local development

Node 22+ is recommended. Node 20 is the minimum for the application tests.

```sh
npm ci
npm test
npx playwright install chromium firefox webkit
npm run test:e2e
npm run build
npm run dev
```

Open http://127.0.0.1:4173 and http://127.0.0.1:4173/editor.html. `npm run dev` serves the last `dist/` build; rebuild after source edits. It intentionally returns an unavailable response for the optional owner API. To run actual Pages Functions locally, use `npx wrangler pages dev dist`; unconfigured privileged operations deny access. Keep local secrets only in gitignored `.dev.vars`.

Build creates `dist/`: static HTML content and metadata from JSON, copied assets, and release.json. The public page remains readable with JavaScript disabled or JSON fetch failure. Deploy **dist**, not public. Wrangler bundles the sibling `functions/` directory during Pages deployment. Plain static hosts support the public page and draft/export editor without the optional publishing service.

## Secure owner publishing (optional)

No browser token input exists. Visitors cannot modify the repository. Until configured, the editor explicitly offers draft/export only and every publishing request is denied.

1. Create a Cloudflare Access self-hosted application covering the editor (`/editor`, `/editor/`, `/editor.html`) and `/api/*` on the production hostname. Restrict the policy to the owner's exact identities. Cover custom domains too. Deployment hostnames also require protection if used for editing; the service independently verifies JWTs to prevent bypass through Pages aliases.
2. In the existing Pages project's **production** Variables and Secrets, set:

   | Name | Value / scope |
   | --- | --- |
   | `ACCESS_TEAM` | Cloudflare Zero Trust team slug, without hostname |
   | `ACCESS_AUD` | Access application's audience tag |
   | `OWNER_EMAILS` | Explicit comma-separated owner email allowlist |
   | `PUBLIC_ORIGIN` | `https://serlekan-links.pages.dev` |
   | `GITHUB_REPOSITORY` | `serlekan/mylinks` |
   | `GITHUB_TOKEN` (secret) | Fine-grained token restricted to this repository; Contents read/write, Actions read, Metadata read |

3. Use a short token expiry and rotate it through Pages secrets. Never reuse a broad CLI/account credential in the application. Do not add workflow-write, repository-admin, or organization permissions. GitHub App credentials are a possible future replacement for expiring PATs.
4. Configure an edge rate-limiting rule for `/api/publish` and appropriate Access session duration. The service limits payloads to 128 KiB and 100 links, uses network timeouts, verifies identity on every request, rejects cross-origin/non-JSON writes, and requires the exact Git blob SHA. GitHub enforces atomic SHA updates, so concurrent submissions and replayed mutations cannot silently overwrite newer versions. Repeated identical content is rejected. GitHub also enforces its API limits; authenticated-owner misuse requires edge rate limiting/revocation.
5. Redeploy, sign in via Access, open the editor, and verify the positive owner journey. Missing or partial configuration fails closed. No fake local login is provided. When Access settings are absent, the static export editor is intentionally public, with no publishing authority.

The API fixes the repository on the server, the branch to main, and the writable path to public/data.json. Imported configuration cannot redirect it. It verifies RS256 signature against the configured team's JWKS, issuer, audience, expiry, required identity claims, and owner email. No client-supplied identity header alone is trusted. Errors exclude upstream response bodies and credentials.

The editor checks that GitHub and deployed JSON agree before enabling publishing, sends the loaded file SHA, and saves a recovery draft before requesting a commit. Conflicts retain edits. It distinguishes commit creation, workflow progress/failure, and a production release marker matching the exact commit. A green workflow without the matching live marker is **not** presented as deployment success. Status can be retried after network errors.

## Existing Cloudflare Pages deployment

Keep `serlekan-links` and production branch main. Do not delete/recreate the project or try to convert Direct Upload to native Git integration.

Repository Actions configuration:

| Type | Name | Value |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | Account-scoped token, Cloudflare Pages: Edit |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Existing account ID |
| Variable | `CF_PAGES_PROJECT` | `serlekan-links` |

The workflow uses read-only GitHub permissions, locked npm dependencies, schema/security tests, an audit, a static build, and Chromium/Firefox/WebKit journeys. Production deployments are serialized with cancellation disabled. Missing configuration fails explicitly, rather than silently skipping deployment. Wrangler v4 deploys dist to the existing project and main branch. Verification checks the immutable deployment and unchanged production URL, exact release marker, data, assets, and denied anonymous publish requests. Browser traces are retained as failure artifacts.

A local release using an existing authorized Wrangler login is also possible after the same checks:

```sh
npm ci
npm test
npm run test:e2e
# Set GITHUB_SHA to the committed release SHA before building.
npm run build
npx wrangler pages deploy dist --project-name=serlekan-links --branch=main --commit-hash=<release-sha>
node scripts/verify-live.mjs
```

This does not configure unattended Actions deployment. Never store a short-lived local OAuth session as a substitute for the required CI token.

For rollback, use the existing project's deployment rollback control or revert the bad Git commit and redeploy. Record the rollback SHA. Preserve public/data.json changes by exporting/reconciling before rollback. A rollback does not repair credentials or Access policy.

## Schema, security and customization

Version 1 preserves the original profile fields (`name`, `eyebrow`, `status`, `intro`, `footer`), repository and links. Optional appearance is `{ "accent": "lime", "cards": "rounded" }`; accents: lime/mint/sky; cards: rounded/square. IDs are unique alphanumeric strings with hyphens/underscores. Public URLs require absolute HTTP(S), no embedded credentials/whitespace/backslashes. All rendering uses text nodes. Unknown fields, malformed types, excessive lengths, unsupported versions and duplicate IDs are rejected consistently in CI/browser/server. Draft structural validation permits incomplete field text without weakening publishing validation.

Public and editor CSS is local; no external font/CDN calls. CSP permits scripts/styles/connect only to self and the same-origin preview frame. It disallows objects and limits embedding to the same origin. Security headers include nosniff, referrer/permissions policies and HSTS. API responses are uncached and have restrictive headers. The public page never depends on Access or owner API availability.

Forks: change repository and profile/links in public/data.json, replace social.png, update the canonical hostname/metadata in scripts/build.mjs, and configure your own fixed server repository/origin and deployment project. Review the workflow's deliberate project-name guard before deploying a fork. Do not reuse Serlekan credentials or identities.

## Project map

- `public/`: page/editor UI, shared schema/renderer, authoritative JSON, CSS, headers and routing.
- `functions/`: Cloudflare Access authorization and session/publish/status APIs.
- `scripts/`: static build, validation tests, local server and live verification.
- `tests/`: signed-JWT/API security tests and browser journeys.
- `docs/REPAIR-PLAN.md`: source reconciliation, findings and repair priorities.
- `docs/RELEASE-REPORT.md`: evidence, limitations and remaining configuration.

Report vulnerabilities privately to the repository owner rather than posting secrets in an issue. Keep the shared schema and negative tests aligned when changing data contracts.

## References

[Cloudflare Direct Upload CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/), [Access JWT verification](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [GitHub Contents API](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents).

`node scripts/live-smoke.mjs` tests the deployed public/editor paths in disposable Chromium, Firefox and WebKit contexts, saves screenshots under `output/playwright/live`, and writes JSON results. Override `BASE_URL` and `OUTPUT_DIR` for a specific release. It changes only local browser drafts and never commits production content.
