# Reliability Roadmap v2

Updated: 2026-09-06

## Purpose

This roadmap reconciles field-QA work with the production governance capabilities that already existed after P5H/P6. It prevents duplicate observability systems and gives future reliability work one unambiguous phase vocabulary.

This roadmap does **not** reopen P6. Historical P5H/P6A/P6B/P6C/P6D records keep their original meaning.

## Current roadmap

| Phase   | Name                     | Status   | Primary outcome                                                                                                                                |
| ------- | ------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 | Development Quality Gate | Complete | Connector/remote commits are auto-formatted before expensive CI work; repository `format:check` remains the final guard.                       |
| Phase A | Field QA Foundation      | Complete | Successful `master` CI waits for the matching successful Vercel deployment and then runs read-only production Playwright checks automatically. |
| Phase B | Operational Visibility   | Active   | B1 provides protected live health checks; B2 adds a bounded privacy-safe Runtime Incident Feed; B3 will aggregate external guard state.        |
| Phase C | Deep Field Verification  | Active   | C1 accessibility and C2 synthetic performance are complete; C3 authenticated disposable CMS validation is in progress.                         |

## Phase B scope

### B1 — System Health Dashboard

`/admin/system-health` sits behind the existing CMS authentication and `dashboard.read` capability. Initial live checks are read-only and bounded: browser/Admin runtime, CMS session, Vercel Admin Proxy → Worker → D1 dashboard read path, public SSR marker, and explicit `unknown` for side-effect services without a safe read-only probe.

### B2 — Runtime Incident Feed

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

### B3 — Health Aggregation

Aggregate safe current-state signals from Phase A, P6A, P6B, P6C, deployment metadata, and B2 incidents through a server-owned boundary. Do not expose GitHub, Vercel, or Cloudflare credentials to the browser.

## Phase C scope

### C1 — Automated accessibility

Status: complete.

Use repository-owned/free tooling to audit representative public/Admin routes. Keep semantic/component regression tests as the primary source of truth and avoid introducing commercial browser services.

### C2 — Synthetic performance regression

Status: complete.

Add release-oriented synthetic budgets that complement, rather than replace, existing Vercel Speed Insights/Web Analytics and build-time performance governance.

### C3 — Authenticated disposable CMS field test

Status: production validation pending.

The implementation uses a manual, master-only workflow behind the existing protected `production` Environment. Each run provisions a random-password, non-root editor directly through the protected production D1 infrastructure boundary, executes a real CMS login/Save/Facebook-thumbnail-fallback/publish/public-read/delete flow, and then hard-cleans the exact run-scoped user and content namespace with `always()` cleanup plus zero-row verification.

Normal Admin credentials are never placed in test code or workflow secrets for this purpose. The mutable C3 suite is kept outside `tests/production`, so it can never be discovered by the automatic read-only Phase A browser smoke.

C3 remains incomplete until the merged implementation passes its protected production workflow on the exact deployed `master` SHA and deterministic cleanup is confirmed.

## What must not be duplicated

The roadmap must reuse the following established controls:

- `X-RCAT-Request-ID` correlation;
- P6A D1 usage observability;
- P6B security/WAF/CSP enforcement;
- P6C recovery and bounded SSR → Worker → D1 reliability checks;
- Phase A deployment-driven production browser QA;
- Vercel Web Analytics and Speed Insights;
- existing CI, dependency governance, and Format Guard.

Do not add Sentry, Datadog, New Relic, BrowserStack, or another paid/external observability stack merely to implement this roadmap.

## Operating principle

Normal repeated operational checks should be automation-first. Manual actions are reserved for deliberate reruns, approval-gated production credentials, recovery actions, or workflows that cannot yet be made safe and disposable.
