# Reliability Roadmap v2

Updated: 2026-09-11

## Purpose

This roadmap reconciles field-QA work with the production governance capabilities that already existed after P5H/P6. It prevents duplicate observability systems and gives future reliability work one unambiguous phase vocabulary.

This roadmap does **not** reopen P6. Historical P5H/P6A/P6B/P6C/P6D records keep their original meaning.

## Current roadmap

| Phase   | Name                     | Status   | Primary outcome                                                                                                                                      |
| ------- | ------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 | Development Quality Gate | Complete | Connector/remote commits are auto-formatted before expensive CI work; repository `format:check` remains the final guard.                             |
| Phase A | Field QA Foundation      | Complete | Successful `master` CI waits for the matching successful Vercel deployment and then runs read-only production Playwright checks automatically.       |
| Phase B | Operational Visibility   | Complete | B1 protected live health checks, B2 privacy-safe Runtime Incident Feed, and B3 server-owned Health Aggregation are complete and production-verified. |
| Phase C | Deep Field Verification  | Complete | C1 accessibility, C2 synthetic performance, and C3 authenticated disposable CMS production validation are complete.                                  |

Reliability Roadmap v2 has no active phase after the 2026-09-11 B3/Phase B closure. Any future reliability work requires a new explicit scope rather than implicitly reopening B1, B2, B3, or Phase C.

## Phase B scope

### B1 — System Health Dashboard

Status: complete.

`/admin/system-health` sits behind the existing CMS authentication and `dashboard.read` capability. Its live checks are read-only and bounded: browser/Admin runtime, CMS session, Vercel Admin Proxy → Worker → D1 dashboard read path, public SSR marker, B3 Health Aggregation, and explicit `unknown` for side-effect services without a safe read-only probe.

### B2 — Runtime Incident Feed

Status: complete and production-verified.

Capture only uncaught runtime errors, unhandled promise rejections, and API network/5xx failures. The contract is intentionally narrower than a generic client log collector.

B2 uses:

- sanitized pathname only, never query/fragment;
- allowlisted error names/classes, never messages or stacks;
- validated `X-RCAT-Request-ID` when available;
- 60-second browser duplicate suppression;
- 5-minute Worker aggregation;
- dedicated 30/minute edge rate limiting;
- seven-day retention and a latest-2,000-row storage bound;
- authenticated `dashboard.read` access for the operator feed in `/admin/system-health`.

It does not collect cookies, tokens, bodies, IP/email/user-agent/form data, or arbitrary exception text. See `docs/operations/phase-b-operational-visibility.md` for the normative contract.

Completion evidence: implementation PR #217 merged as `76ca0be1c17715b9e6cc2ec71de8d8e7eef81ea4`; repository CI run `33730760569` and Phase A Production Browser Smoke run `33731028288` succeeded for that merge. The canonical Worker production release followed through PR #218 at `51d286ddebbe0f05b5ddb21af601768ba0e472c3`; Worker Production Release run `33731760770` and the follow-up Phase A Production Browser Smoke run `33732058524` succeeded. Migration `0014_b2_runtime_incidents.sql` therefore crossed the documented B2 production completion gate.

### B3 — Health Aggregation

Status: complete and production-verified.

B3 aggregates safe current-state signals from Phase A, P6A, P6B, P6C, deployment metadata, and B2 incidents through the server-owned Vercel endpoint `GET /api/health-aggregation`. GitHub, Vercel, and Cloudflare infrastructure credentials are not exposed to the browser.

The existing CMS Session and Worker `dashboard.read` boundary remain authoritative. P6A protected-Environment waiting is treated as expected/unknown, Vercel `Ignored Build Step` is distinguished from a real deployment success, and B2 data is reduced to a bounded 24-hour summary before it reaches the System Health check.

Completion evidence: PR #270 merged to `master` as `cda947149fee0e79791bfc401efbc5c33f3adbb9`; final implementation head `b10ab8c99117fa1e254bd420df3f69de5ec77182` passed repository CI #2007, run `34547284821`; Vercel production deployment `dpl_94AZDYbaLc61t2XbmxMFCw1GQZyP` for the merge SHA reached `READY`; and an unauthenticated request to the exact production deployment endpoint returned the expected HTTP `401` fail-closed response with `Cache-Control: no-store`, Request ID correlation, and enforced P6B security markers.

The normative implementation and closure evidence is recorded in `docs/architecture/b3-health-aggregation-implementation-2026-09-11.md` and `docs/operations/phase-b-operational-visibility.md`.

## Phase C scope

### C1 — Automated accessibility

Status: complete.

Use repository-owned/free tooling to audit representative public/Admin routes. Keep semantic/component regression tests as the primary source of truth and avoid introducing commercial browser services.

### C2 — Synthetic performance regression

Status: complete.

Add release-oriented synthetic budgets that complement, rather than replace, existing Vercel Speed Insights/Web Analytics and build-time performance governance.

### C3 — Authenticated disposable CMS field test

Status: complete.

C3 uses a manual, master-only workflow behind the existing protected `production` Environment. Each run provisions a random-password, non-root editor directly through the protected production D1 infrastructure boundary, executes a real CMS login/Save/Facebook-thumbnail-fallback/publish/public-read/delete flow, and then hard-cleans the exact run-scoped user and content namespace with `always()` cleanup plus zero-row verification.

Normal Admin credentials are never placed in test code or workflow secrets for this purpose. The mutable C3 suite remains outside `tests/production`, so it cannot be discovered by the automatic read-only Phase A browser smoke.

Completion evidence is Phase C3 Round 19, GitHub Actions run `34126501500`, on exact `master` SHA `88ef27396472d618fbf2091c4bab0255c4d31397`. The browser field test passed, deterministic cleanup passed, and the final QA user/credential/session/content counts were all verified as zero.

After closure, C3 remains available only as a deliberate manual protected deep-production regression tool. Normal Worker production releases do not automatically dispatch C3.

## What must not be duplicated

The roadmap must reuse the following established controls:

- `X-RCAT-Request-ID` correlation;
- P6A D1 usage observability;
- P6B security/WAF/CSP enforcement;
- P6C recovery and bounded SSR → Worker → D1 reliability checks;
- Phase A deployment-driven production browser QA;
- Phase B B1/B2/B3 operator visibility controls;
- Vercel Web Analytics and Speed Insights;
- existing CI, dependency governance, and Format Guard.

Do not add Sentry, Datadog, New Relic, BrowserStack, or another paid/external observability stack merely to recreate this completed roadmap.

## Operating principle

Normal repeated operational checks should be automation-first. Manual actions are reserved for deliberate reruns, approval-gated production credentials, recovery actions, or workflows that cannot safely run unattended. Completed mutable field-verification workflows such as C3 must remain manual unless a new explicit scope reopens automation for them. Completed Phase B visibility remains read-only and explicit-refresh driven; do not add background polling merely because Phase B is closed.
