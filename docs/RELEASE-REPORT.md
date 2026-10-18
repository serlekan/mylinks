# Release verification and operating limits

Source reconciliation and priorities: REPAIR-PLAN.md. See README.md for setup and recovery instructions.

## Implemented
- Shared schema and safe public renderer; built static fallback, metadata and social image.
- Profile/footer, link CRUD/visibility, drag and button ordering, appearance, same-page mobile/desktop preview, drafts/import/export/discard/dirty state.
- Removed browser credential entry. Optional Pages owner service uses verified Access JWTs, explicit identities, fixed repository/main/data path, bounded bodies, exact origin and atomic GitHub SHA checks.
- Truthful deployment states: workflow state plus exact production commit marker. Failed publishing preserves local edits.
- Locked dependencies, read-only CI repository permissions, serialized deployment, browser/security tests, audit and live verification.

## Review and test evidence
An independent reviewer checked the editor, shared renderer/schema, owner service and deployment scripts. Fixed both incomplete-draft restoration and draft-size recovery findings. Browser tests also identified and repaired editor textarea initialization and WebKit keyboard focus. Static fallback tests cover JavaScript-disabled operation and failed JSON loading; the build handles formatted markup.

Automated suites cover signed owner/nonowner/forged/expired/wrong-audience JWTs, CSRF, payload limits, fixed publishing target, stale SHA, pinned GitHub writes, unsafe URLs/imports, drafts and recovery, all editor sections, native dragging and buttons, literal XSS text, mobile overflow, keyboard focus, unsaved navigation and WCAG AA scans. Successful-publish browser tests mock the owner service; they do not claim a live authenticated owner publish occurred.

## Configuration status at release preparation
- Existing Cloudflare project serlekan-links and production branch main confirmed through dashboard and Wrangler. No replacement project created.
- CF_PAGES_PROJECT=serlekan-links and CLOUDFLARE_ACCOUNT_ID configured in GitHub after verifying they were absent.
- CLOUDFLARE_API_TOKEN is absent. Unattended deployment cannot succeed until a repository secret with Pages:Edit on this account is supplied. Workflow fails explicitly and does not disguise this as a successful deployment.
- Existing authorized local Wrangler OAuth login has Pages write capability and can be used for this release. Do not copy that short-lived session into CI.
- Pages production secret list is empty. Cloudflare Access application/team/audience, explicit owner identity policy and repository-scoped server GITHUB_TOKEN are not configured. Live owner sign-in/publish cannot be accepted yet. Anonymous publishing must remain denied. Export-and-commit remains usable.
- Edge rate limiting for owner publishing must be configured along with Access; authorization, SHA replay protection, size limits and GitHub limits are already enforced by code.

## Acceptance boundary
No 95–98% readiness percentage is claimed. The positive authenticated production publish/deployment journey and unattended CI are external configuration blockers, even when the public site and export editor are deployed successfully. Production release SHA, URL checks, screenshots and exact final command results are recorded in the release deliverable accompanying this task. A successful upload is only a candidate until live verification passes.
