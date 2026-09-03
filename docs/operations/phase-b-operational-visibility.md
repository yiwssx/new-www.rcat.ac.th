# Phase B — Operational Visibility

Updated: 2026-09-03

Status: active requested reliability scope.

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

Each network probe is bounded by an abort timeout. HTTP 5xx and authenticated 401/403 outcomes are treated as errors; other non-success HTTP outcomes are warnings. Public SSR returning 200 without the expected SSR marker is a warning.

## Request correlation and privacy

B1 reuses `X-RCAT-Request-ID`. It does not generate a second tracing identifier.

A response request ID is displayed only when it matches the expected UUID-shaped contract. Arbitrary header values are discarded.

The dashboard does not display or persist:

- cookies or session tokens;
- CSRF/MFA/recovery/password-reset/invitation tokens;
- request or response bodies;
- raw query strings;
- passwords or form values;
- authorization/proxy secrets;
- raw error stacks/messages from upstream services;
- Cloudflare account/database IDs or production credentials.

Failure copy is intentionally finite and generic. Operators should use a valid Request ID plus approximate time when deeper server-log correlation is required.

## Existing operational guard ownership

B1 does not replace or reschedule existing automation:

- Phase A owns deployment-driven production browser QA;
- P6A owns D1 utilization monitoring and remains protected-Environment approval-gated;
- P6B owns security/WAF/CSP enforcement checks;
- P6C owns bounded six-hour SSR → Worker → D1 reliability verification.

The initial dashboard labels these as external operational guards and links operators to GitHub Actions. It does **not** call GitHub from the browser with a token. Server-owned latest-run aggregation is B3 scope.

## B2 — Runtime Incident Feed

B2 follows only after B1 is merged and production-verified. Before adding persistent browser incident recording, the implementation must define:

- exact event allowlist;
- deduplication;
- retention period and cleanup;
- rate limits;
- storage/schema impact;
- authorization for reading incident records;
- redaction tests aligned with `docs/operations/request-correlation.md`.

No generic client log collector or raw exception/body ingestion is approved by B1.

## B3 — Health Aggregation

B3 may later aggregate current Phase A/P6A/P6B/P6C/deployment/incident signals through a server-owned endpoint. Browser-side infrastructure credentials are prohibited.

## Cost boundary

B1 uses the existing React/MUI application, current APIs, request correlation, and GitHub Actions link. No new paid tool, SaaS, database, or monitoring provider is added.

## B1 completion gate

B1 is complete only after:

1. route/navigation/capability boundaries are covered by tests;
2. health classification and request-ID sanitization tests pass;
3. repository CI/governance is green;
4. the change is merged to `master`;
5. the automatic Phase A production browser verification for the merge commit succeeds.
