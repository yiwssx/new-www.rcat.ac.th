# Reliability Roadmap v2

Updated: 2026-09-03

## Purpose

This roadmap reconciles the new field-QA work with the production governance capabilities that already existed after P5H/P6. It prevents duplicate observability systems and gives future reliability work one unambiguous phase vocabulary.

This roadmap does **not** reopen P6. Historical P5H/P6A/P6B/P6C/P6D records keep their original meaning.

## Current roadmap

| Phase   | Name                     | Status   | Primary outcome                                                                                                                                 |
| ------- | ------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 | Development Quality Gate | Complete | Connector/remote commits are auto-formatted before expensive CI work; repository `format:check` remains the final guard.                        |
| Phase A | Field QA Foundation      | Complete | Successful `master` CI waits for the matching successful Vercel deployment and then runs read-only production Playwright checks automatically.  |
| Phase B | Operational Visibility   | Active   | Give operators one protected Admin view for safe live health checks and later privacy-safe runtime incident aggregation.                        |
| Phase C | Deep Field Verification  | Planned  | Add accessibility, synthetic performance regression, and isolated authenticated/disposable CMS field tests without weakening production safety. |

## Phase B scope

### B1 — System Health Dashboard

Create `/admin/system-health` behind the existing CMS authentication and `dashboard.read` capability. Reuse current boundaries instead of creating a new privileged health service.

Initial live checks are read-only and bounded:

- browser/Admin frontend runtime;
- CMS authentication session endpoint;
- existing Vercel Admin Proxy → Cloudflare Worker → D1 dashboard read path;
- public SSR response and SSR marker;
- explicit `unknown` for side-effect services that do not yet expose a safe read-only health endpoint.

The page may display a validated `X-RCAT-Request-ID` returned by existing server boundaries. It must not display request/response bodies, cookies, tokens, arbitrary query strings, user credentials, raw stack traces, or protected infrastructure identifiers.

Existing Phase A/P6A/P6B/P6C workflows remain the owners of their current automation. B1 does not query GitHub with a browser token and does not create another scheduler.

### B2 — Runtime Incident Feed

After B1 is stable, capture a deliberately narrow set of browser/runtime failures such as uncaught errors, unhandled promise rejections, and selected API failures. Reuse the existing request-correlation privacy contract. Define retention, deduplication, storage, and authorization before adding persistence.

### B3 — Health Aggregation

Aggregate safe current-state signals from Phase A, P6A, P6B, P6C, deployment metadata, and B2 incidents through a server-owned boundary. Do not expose GitHub, Vercel, or Cloudflare credentials to the browser.

## Phase C scope

### C1 — Automated accessibility

Use repository-owned/free tooling to audit representative public/Admin routes. Keep semantic/component regression tests as the primary source of truth and avoid introducing commercial browser services.

### C2 — Synthetic performance regression

Add release-oriented synthetic budgets that complement, rather than replace, existing Vercel Speed Insights/Web Analytics and build-time performance governance.

### C3 — Authenticated disposable CMS field test

Only after an isolated QA identity and disposable-data contract exist, automate real CMS workflows such as login, Save progress, Facebook thumbnail fallback, public verification, and deterministic cleanup. Never place normal Admin credentials in test code or mutate ordinary production content merely to prove a test.

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
