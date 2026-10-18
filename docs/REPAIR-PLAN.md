# Discovery and repair plan — 2026-10-18

## Evidence before implementation
- Inspected all 13 tracked files and both commits (main: 159a088).
- Read C:/Users/lekan/Documents/CV/serlekanworks.html successfully. Same founder copy and dark/lime design as repository. Local portfolio URL lacks /en/; repository has the mission-required /en/ and is retained.
- Production HTTP 200 serves a single inline HTML page, with Selected Work pointing to works.serlekan.chatgpt.site. It does not serve the repository application. No verified evidence that this destination supersedes the explicit mission URL.
- Cloudflare dashboard confirms existing serlekan-links, production branch main, existing c9d78c39 deployment. Preserve project and URL.
- GitHub Actions run 39091583069: validate passed, deploy SKIPPED. Repository secrets list and variables list are empty. Existing local Workers API credential cannot read this Pages project (401); do not replace or disclose credentials.
- Existing UI requires browser GitHub token; no server authorization. Missing preview, appearance, dirty state, drag sorting, discard. Structural operations call full validation and are blocked by incomplete fields. Schema differs across public/editor/tests, limits incomplete. Inline editor style violates CSP. No browser tests. No concurrency or production verification in CI.

## Approved mission architecture
Keep public/data.json authoritative, retain static HTML/CSS/JS and reference design. Shared strict validator serves browser, CI and Pages Functions. Public renderer also powers a same-origin iframe preview (mobile/desktop), with origin/source checks. Draft state is browser-local, supports incomplete edits, and does not affect published data. Validated export/commit always works without owner service.

Replace browser token entry entirely with an optional authenticated Pages API: verify Cloudflare Access JWT signature, issuer, audience, expiry, and an explicit owner email allowlist. Credentials live only in Pages secrets; repository/branch/path are server controlled. Mutations require exact origin and optimistic Git blob SHA. Missing configuration denies every write. Protect editor route when Access is configured; export editor stays publicly available if it is not. No pretend login.

## Priorities and verification
1. Shared schema + negative security tests: types, sizes, duplicate IDs, HTTP(S), credentials, unknown fields, appearance enums.
2. Public renderer and real preview; matching static fallback and metadata; narrow CSP and responsive design.
3. Editor: raw state independent of validation; profile/link/appearance controls, drag/buttons, drafts, import/export, confirmations, unsaved state, conflicts, polling truthful commit/deploy/live status.
4. Pages API with JWT validation, fixed destination, CAS and sanitized errors; tests exercise missing config, forged JWT, CSRF and conflict.
5. CI installs locked dependencies, tests and browser tests before serialized deployment to existing project; missing config fails explicitly; verify immutable and production release markers.
6. Independent review, remediation, source and browser verification, push main per mission. Deploy through Actions only when authorized Pages credentials are available. Report precise external blockers; never call a skipped deployment success.

## External configuration currently absent
GitHub secrets CLOUDFLARE_API_TOKEN (Pages:Edit on this account), CLOUDFLARE_ACCOUNT_ID; variable CF_PAGES_PROJECT=serlekan-links. Pages publishing additionally needs Access application/team/audience and explicit owner identities plus repository-scoped GitHub server credential (Contents read/write; Actions read). No token will be collected in a web editor.
