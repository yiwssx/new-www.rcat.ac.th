# P6D Product/UX Improvements

Status: active.

Started: 2026-08-30.

## Goal

P6D is the final planned development phase in the P6 roadmap. It improves practical user-facing behavior without reopening architecture, security, recovery, or Admin UX work that is already complete.

## Scope

P6D is intentionally narrow and evidence-driven. The implementation addresses user journeys where the current UI leaves a person with stale state, misleading copy, or no useful recovery action:

- make the shared not-found page public-facing instead of describing an unknown route as a CMS-only problem;
- provide direct Home and Search recovery actions from not-found state;
- provide a Home recovery action from public data-load errors in addition to retry;
- keep the public search input synchronized with the canonical URL query when the route changes without remounting;
- provide an explicit clear-search action and useful exits when a search returns no results;
- announce updated search-result counts politely to assistive technology.

## Non-goals

P6D does not change:

- Cloudflare Worker or D1 runtime ownership;
- D1 migrations or production data;
- authentication, session, MFA, CSRF, or RBAC policy;
- WAF, CSP, rate-limit, or anomaly-detection controls from P6B;
- P6C recovery objectives, rollback procedures, or Time Travel readiness;
- Apps Script or Google Drive integration;
- Vercel routing, environment variables, or production provider topology;
- the completed Admin UX 00-10 sequence.

## Acceptance gates

P6D is complete only when all of the following are true:

1. focused P6D regression tests pass;
2. repository CI passes all required lanes and the protected `quality` aggregate;
3. the merged `master` revision receives a successful Vercel production deployment/status;
4. the public homepage and search route remain reachable in production;
5. the current project-state and operator guidance record P6D as completed;
6. no new P6 feature phase is created as part of closure.

## Closure rule

After these gates pass, P6D is closed as the final planned P6 development phase. Future dependency updates, monitoring, security alerts, and narrowly scoped bug fixes are maintenance work unless a new product project is explicitly requested.
