# Phase B — Operational Visibility

Updated: 2026-09-11

Status: complete and production-verified. B1 System Health Dashboard, B2 Runtime Incident Feed, and B3 Health Aggregation are complete and production-verified.

## Goal

Phase B turns existing production reliability signals into operator-facing visibility without building a duplicate monitoring stack or weakening existing production credential boundaries.

Phase B follows completed Phase 0 Development Quality Gate and completed Phase A Field QA Foundation. The reconciled roadmap is `docs/architecture/reliability-roadmap-v2.md`.

## B1 — `/admin/system-health`

Status: complete.

B1 adds a protected, read-only system health dashboard to the existing CMS shell.

Authorization:

- normal CMS authentication is still owned by `ProtectedLayout`;
- the route reuses the existing `dashboard.read` capability;
- no new role, capability, bypass, token, or public health endpoint is introduced.

Live checks:

1. **Frontend runtime** — confirms the Admin application root is present.
2. **CMS Authentication** — reads the existing `/api/cms-auth/session` endpoint.
3. **Admin API / Worker / D1** — reads the existing `/api/admin/dashboard-summary` path through the configured Admin provider, which exercises the current Vercel Admin Proxy → Cloudflare Worker → D1 boundary.
4. **Public SSR** — reads `/` as HTML and verifies the expected RCAT SSR marker.
5. **Health Aggregation · B3** — reads the server-owned `/api/health-aggregation` boundary and summarizes Phase A/P6A/P6B/P6C, deployment metadata, and bounded B2 incident state.
6. **Facebook Thumbnail Bridge** — deliberately reports `unknown` rather than performing an import/create request. A side-effect operation is not a health probe.

The checks run once when the page opens and only rerun when the operator explicitly requests another check. There is no interval polling.

## B2 — Runtime Incident Feed

Status: complete and production-verified.

B2 records only a narrow, predefined set of production browser failures:

- `runtime_error` — uncaught browser errors;
- `unhandled_rejection` — unhandled promise rejections;
- `api_failure` — API network failures or HTTP 5xx responses.

The browser recorder is installed after the existing browser-error filters. Filtered browser-extension noise therefore remains filtered before B2 observes ordinary error propagation. Existing public analytics endpoints and the runtime-incident endpoint itself are excluded from API-failure capture so telemetry cannot recursively report its own failures.

### Privacy contract

B2 persists only:

- finite incident kind and surface (`public`, `admin`, `auth`, `unknown`);
- sanitized pathname with query/fragment removed;
- allowlisted error class/name, never the error message;
- API method and 5xx status when applicable;
- validated UUID-shaped `X-RCAT-Request-ID` when an affected API response supplies one;
- server-owned first/last seen timestamps and aggregate occurrence count.

B2 does **not** persist or display:

- error messages or stack traces;
- request or response bodies;
- query strings or fragments;
- cookies, session tokens, CSRF/MFA/recovery/password-reset/invitation tokens;
- authorization/proxy secrets;
- IP addresses, email addresses, usernames, User-Agent strings, form values, or page titles.

Token-like, UUID-shaped, long hexadecimal, and sensitive-path-following segments are replaced with `:redacted` before persistence. Arbitrary error names are collapsed to `OtherError`.

### Deduplication, limits, and retention

- browser-side duplicate suppression window: **60 seconds**;
- Worker aggregation bucket: **5 minutes** for the same sanitized incident fingerprint;
- public ingest rate limit: dedicated Cloudflare Rate Limiting binding at **30 requests/minute/client key**;
- persistent retention: **7 days**;
- storage bound: latest **2,000 aggregated incident rows**;
- normal daily Worker retention cleanup also reapplies the 7-day and 2,000-row bounds.

No D1 rate-counter row is written for every incident. B2 reuses the same Cloudflare edge rate-limiting mechanism already used by public analytics/security controls.

### Storage and endpoints

Migration `0014_b2_runtime_incidents.sql` adds the append-only `runtime_incidents` operational table plus dedupe and recency indexes.

Public ingestion is `POST /api/public/runtime-incident`. It uses the existing `PUBLIC_ANALYTICS_ALLOWED_ORIGINS` browser-origin allowlist and a dedicated runtime-incident rate-limit namespace. Invalid or non-allowlisted event shapes are rejected before persistence.

Operator reading is `GET /api/admin/runtime-incidents`. It is not a public read API: the Worker requires the existing private CMS server-proxy authentication boundary, Admin API rate limiting, and `dashboard.read`. The browser reaches it through the existing Vercel Admin Proxy; no Worker secret is exposed client-side.

`/admin/system-health` reads the last 24 hours, up to 25 aggregate groups, only when the page performs its normal explicit health refresh. There is no background polling.

### Completion evidence

B2 crossed its documented completion gate on 2026-09-03:

- implementation PR #217 merged as `76ca0be1c17715b9e6cc2ec71de8d8e7eef81ea4`;
- repository CI run `33730760569` succeeded for that merge;
- Phase A Production Browser Smoke run `33731028288` succeeded for that merge;
- canonical Worker production release PR #218 merged as `51d286ddebbe0f05b5ddb21af601768ba0e472c3`;
- Worker Production Release run `33731760770` succeeded, applying the production Worker release path that includes migration `0014_b2_runtime_incidents.sql`;
- follow-up Phase A Production Browser Smoke run `33732058524` succeeded for the release commit.

B2 is complete and remains part of the closed Phase B baseline.

## Request correlation

B1, B2, and B3 reuse `X-RCAT-Request-ID`. They do not generate a second tracing identifier.

A request ID is stored/displayed only when it matches the UUID-shaped contract. Browser-supplied arbitrary values are discarded. Request IDs are operational correlation values, not identity or authorization inputs.

Operators should use a valid Request ID plus approximate time when deeper server-log correlation is required.

## Existing operational guard ownership

Phase B does not replace or reschedule existing automation:

- Phase A owns deployment-driven production browser QA;
- P6A owns D1 utilization monitoring and remains protected-Environment approval-gated;
- P6B owns security/WAF/CSP enforcement checks;
- P6C owns bounded six-hour SSR → Worker → D1 reliability verification.

B3 reads latest safe operational metadata only when `/admin/system-health` is explicitly refreshed. GitHub metadata is fetched by the Vercel server boundary after existing CMS authorization succeeds; no GitHub token or infrastructure credential is exposed to the browser.

## B3 — Health Aggregation

Status: complete and production-verified.

B3 adds `GET /api/health-aggregation` as a read-only Vercel server-owned boundary. It aggregates:

- latest Phase A Production Browser Smoke state;
- latest P6A Production Observability state, with protected-Environment waiting treated as expected/unknown rather than an incident;
- latest P6B Production Security state;
- latest P6C Production Reliability state;
- Vercel commit-status metadata for `master`, distinguishing `Ignored Build Step` from a real deployment success; and
- a bounded 24-hour B2 incident summary.

Authorization and safety properties:

- the browser sends only the existing CMS Session cookie;
- the Vercel server uses the existing server-only proxy secret to read the Worker B2 admin endpoint;
- the Worker remains authoritative for Session validation, Admin rate limiting, and `dashboard.read`;
- GitHub public repository metadata is queried only after that authorization path succeeds;
- no new browser infrastructure credential, role, capability, secret, Environment, D1 migration, schedule, or paid monitoring stack is introduced;
- the endpoint is `no-store` and returns only bounded finite status metadata.

### Completion evidence

B3 crossed its completion gate on 2026-09-11:

- implementation PR #270 merged to `master` as `cda947149fee0e79791bfc401efbc5c33f3adbb9`;
- final implementation head `b10ab8c99117fa1e254bd420df3f69de5ec77182` passed repository CI #2007, run `34547284821`;
- Vercel production deployment `dpl_94AZDYbaLc61t2XbmxMFCw1GQZyP` for merge SHA `cda947149fee0e79791bfc401efbc5c33f3adbb9` reached `READY`;
- an unauthenticated request to the exact production deployment `/api/health-aggregation` returned the expected HTTP `401` fail-closed response with `Cache-Control: no-store`, UUID-shaped `X-RCAT-Request-ID`, P6B WAF marker, and enforced security-baseline marker;
- canonical reliability/project-state guidance is reconciled by the Phase B closure change.

Implementation and production evidence are also recorded in `docs/architecture/b3-health-aggregation-implementation-2026-09-11.md`.

## Cost boundary

B1/B2/B3 use the existing React/MUI application, Vercel server boundary, Cloudflare Worker + D1, current rate-limiting mechanism, request correlation, and GitHub Actions/public repository metadata. No Sentry, Datadog, New Relic, BrowserStack, paid monitoring provider, or new paid SaaS is added.

## B2 completion gate

B2 is complete only after:

1. event allowlist, sanitization, 60-second client dedupe, 5-minute Worker aggregation, 7-day retention, and 2,000-row bounds are covered by tests;
2. public origin and rate-limit controls are covered by tests;
3. the Admin incident feed remains behind CMS server-proxy authentication and `dashboard.read`;
4. repository CI/governance is green;
5. the change is merged to `master`;
6. the production Worker release applies migration `0014_b2_runtime_incidents.sql` and deploys the matching Worker code;
7. the automatic Phase A production browser verification for the merge commit succeeds.

All seven conditions are satisfied by the B2 completion evidence above.

## B3 completion gate

B3 is complete only after:

1. focused server/frontend contract tests and repository CI/governance pass;
2. the implementation is merged to `master`;
3. the matching Vercel production deployment reaches `READY`;
4. the production endpoint is present and preserves the authenticated/no-store boundary; and
5. canonical Phase B/project-state documents are reconciled.

All five conditions are satisfied by the B3 completion evidence above.

## Phase B closure

Phase B Operational Visibility is complete and production-verified. B1, B2, and B3 are closed work. Do not report Phase B as active or B3 as planned unless a newer explicit project-state decision reopens reliability work under a new scope.
