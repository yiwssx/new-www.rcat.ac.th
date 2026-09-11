# Copilot Instructions

This repository is a React/Vite public website and CMS with Cloudflare Worker/D1 backend paths, Vercel admin proxy paths, and an Apps Script media/file bridge.

## Current Project Status

Current status: post-P5H production governance baseline with Production Observability configured behind the protected `production` Environment reviewer gate, completed P6B Security Enforcement, completed P6C Recovery & Reliability, completed P6D Product/UX Improvements, completed Admin UX 00-10, and ongoing governed dependency maintenance. There is no active P6 feature-development phase.

Reliability Roadmap v2 is separate from P6 and is complete. Phase 0 Development Quality Gate, Phase A Field QA Foundation, Phase B Operational Visibility, and Phase C Deep Field Verification are complete. Within Phase B, B1 System Health Dashboard, B2 Runtime Incident Feed, and B3 Health Aggregation are complete and production-verified. Completed C3 authenticated CMS verification remains manual/protected and must not be coupled back into normal Worker production releases without new explicit scope.

Production environment retirement follow-ups are complete and operator-verified as of 2026-09-11. Live Vercel Production uses server-only `COMPLAINT_API_URI`; retired `VITE_COMPLAINT_API_URI` is absent from the live Vercel environment; and legacy-only CMS-auth environment values are retired from the applicable Vercel/Cloudflare environments. Compatibility parsing in server source is not evidence that a retired value is still configured.

M13-M21 documents are historical migration/stabilization records. Do not report M20 or M21 as the current active phase, and do not reuse legacy M21 active-ownership or open-stabilization status wording in current project guidance.

## Current Source Of Truth

Use these files as current references:

- `docs/architecture/post-p5h-current-project-state.md` — canonical project-state note.
- `docs/architecture/current-runtime-ownership.md` — current runtime ownership.
- `docs/deployment/runtime-deployment-guide.md` — current deployment behavior.
- `docs/development/environment-variables.md` — current environment-variable ownership.
- `docs/operations/environment-retirement-verification-2026-09-11.md` — operator-verified complaint/CMS-auth environment retirement state.
- `docs/architecture/reliability-roadmap-v2.md` — completed reliability phase definitions and evidence.
- `docs/operations/phase-b-operational-visibility.md` — completed Phase B/B1-B3 scope and production evidence.
- `docs/architecture/b3-health-aggregation-implementation-2026-09-11.md` — B3 implementation and production-verification record.
- `docs/operations/phase-c-deep-field-verification.md` — completed Phase C operating context.
- `docs/admin/admin-ux-execution-tracker.md` — completed Admin UX sequence.
- `AGENTS.md` — repository-wide agent operating rules.

Historical M13-M21 milestone documents may be used as evidence for their original checkpoints, but they do not override the current source-of-truth files above.

## Current Runtime Ownership

- Public structured reads: Cloudflare Worker and D1.
- Public analytics, site view, content view, visitor presence, and live visitor stats: Cloudflare Worker and D1.
- B2 Runtime Incident Feed ingest and protected aggregates: Cloudflare Worker and D1.
- Admin structured reads and writes: Cloudflare Worker and D1.
- Admin user access: Cloudflare RBAC plus D1 `app_admin_users`.
- Admin session proxy: Vercel server-side proxy.
- B3 Health Aggregation: Vercel server-owned `/api/health-aggregation`, explicit refresh only.
- Media/file bridge: Apps Script behind the Vercel proxy.
- File storage: Google Drive.
- Complaint submission: Vercel `/api/complaint` to the dedicated Complaint Apps Script, configured by live server-only `COMPLAINT_API_URI`.

## Current Feedback And UX Standards

- Admin write operations use blocking loading modals while pending, centered success modals requiring acknowledgment, centered error modals requiring acknowledgment, and no short auto-dismiss final-result success toast.
- This standard applies to Media, Content, Documents, Menu, Users, Calendar, Carousel, E-Service, and Settings.
- Urgent marquee speed is normalized by pixels per second with distance-based duration. Reduced motion slows the ticker instead of disabling it.

## Reliability Boundaries

- Reuse `X-RCAT-Request-ID`; do not create a parallel request-correlation identifier.
- Phase A owns deployment-driven read-only production browser QA.
- P6A owns D1 utilization observability and remains protected-Environment approval-gated.
- P6B owns security/WAF/CSP verification.
- P6C owns the bounded six-hour SSR → Worker → D1 reliability guard.
- Phase B B1/B2/B3 are complete. B3 is server-owned explicit-refresh aggregation through `/api/health-aggregation`; do not add browser infrastructure credentials or background polling.
- Phase C is complete; C3 is manual-only after closure.
- Do not add a duplicate paid observability stack merely to recreate existing guards.
- New reliability work requires an explicit new scope; do not silently reopen Phase B.

## Do Not Reintroduce

- Direct frontend Apps Script user management.
- Direct frontend Apps Script structured-data reads or writes.
- Local bootstrap users.
- Local password-hash user fallback.
- Legacy Apps Script credential login.
- Production auth that depends on direct frontend Apps Script.
- Retired `VITE_COMPLAINT_API_URI` in live Vercel Production.
- Legacy-only CMS-auth environment values retired by the final cutover.
- The deleted `rcat-public-api-production` Worker/D1 as a current production target; the canonical live resource is the in-place `rcat-public-api-preview` physical resource under `env.production`.
- A persistent Cloudflare Preview environment or `--env preview` operational procedure unless a new explicit environment is designed and approved.
- M20/M21 active-phase wording in current-facing guidance.
- Worker → C3 automatic dispatch or one-time C3 release scaffolding.
- B3 browser-side infrastructure credentials or interval polling.

## Safety Rules

- Do not commit real secrets, tokens, D1 IDs, Access AUD values, or production credentials.
- Do not mutate production services unless explicitly requested.
- Keep D1 migrations append-only.
- Keep Apps Script only for media/file bridge operations, except the separately isolated complaint Apps Script behind Vercel `/api/complaint`.
- Prefer Cloudflare Worker and D1 for structured public/admin data.
- Reuse existing credentials and protected Environments before considering new ones.
- New product or reliability work requires explicit new scope; do not silently extend completed P6, Phase B, or M21 phases.

## Sigmap

Sigmap is retained as an AI helper workflow. Use it when useful for repository-aware code navigation.

Common commands:

```bash
pnpm ai:ask
pnpm ai:validate
pnpm ai:map
```
