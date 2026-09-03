# Phase B — Operational Visibility

Updated: 2026-09-03

Status: active. B1 is complete; B2 adds the privacy-safe Runtime Incident Feed. B3 remains planned.

## Goal

Phase B turns existing production reliability signals into operator-facing visibility without building a duplicate monitoring stack or weakening existing production credential boundaries.

Phase B follows completed Phase 0 Development Quality Gate and completed Phase A Field QA Foundation. The reconciled roadmap is `docs/architecture/reliability-roadmap-v2.md`.

## B1 — `/admin/system-health`

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
5. **Facebook Thumbnail Bridge** — deliberately reports `unknown` rather than performing an import/create request. A side-effect operation is not a health probe.

The checks run once when the page opens and only rerun when the operator explicitly requests another check. There is no interval polling.

## B2 — Runtime Incident Feed

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

## Request correlation

B1 and B2 reuse `X-RCAT-Request-ID`. They do not generate a second tracing identifier.

A request ID is stored/displayed only when it matches the UUID-shaped contract. Browser-supplied arbitrary values are discarded. Request IDs are operational correlation values, not identity or authorization inputs.

Operators should use a valid Request ID plus approximate time when deeper server-log correlation is required.

## Existing operational guard ownership

Phase B does not replace or reschedule existing automation:

- Phase A owns deployment-driven production browser QA;
- P6A owns D1 utilization monitoring and remains protected-Environment approval-gated;
- P6B owns security/WAF/CSP enforcement checks;
- P6C owns bounded six-hour SSR → Worker → D1 reliability verification.

The dashboard links operators to GitHub Actions. It does **not** call GitHub from the browser with a token. Server-owned latest-run aggregation remains B3 scope.

## B3 — Health Aggregation

B3 may later aggregate current Phase A/P6A/P6B/P6C/deployment/incident signals through a server-owned endpoint. Browser-side infrastructure credentials are prohibited.

## Cost boundary

B1/B2 use the existing React/MUI application, Cloudflare Worker + D1, current rate-limiting mechanism, request correlation, and GitHub Actions. No Sentry, Datadog, New Relic, BrowserStack, paid monitoring provider, or new paid SaaS is added.

## B2 completion gate

B2 is complete only after:

1. event allowlist, sanitization, 60-second client dedupe, 5-minute Worker aggregation, 7-day retention, and 2,000-row bounds are covered by tests;
2. public origin and rate-limit controls are covered by tests;
3. the Admin incident feed remains behind CMS server-proxy authentication and `dashboard.read`;
4. repository CI/governance is green;
5. the change is merged to `master`;
6. the production Worker release applies migration `0014_b2_runtime_incidents.sql` and deploys the matching Worker code;
7. the automatic Phase A production browser verification for the merge commit succeeds.
