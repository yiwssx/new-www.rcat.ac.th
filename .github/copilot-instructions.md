# Copilot Instructions

This repository is a React/Vite public website and CMS with Cloudflare Worker/D1 backend paths, Vercel admin proxy paths, and an Apps Script media/file bridge.

## Current Project Status

Current status: **v3.3.2 production-governance and governed-maintenance baseline on `main`**. The v3.3.2 Content Editor Performance release is complete, production-released, production-verified, tagged, and published. Do not repeat its Vercel deployment or production verification merely because an older tracker or dated record describes a pre-release checkpoint. The preceding v3.3.1 Content Operations D1 migrations and Worker production release are also complete and must not be repeated as later reconciliation.

Production Observability is configured as a manual-only guard behind the protected `production` Environment reviewer gate. P6B Security Enforcement, P6C Recovery & Reliability, P6D Product/UX Improvements, Admin UX 00-10, and Reliability Roadmap v2 are complete. There is no active P6 feature-development, Reliability Roadmap v2 implementation, migration, release, or Content Editor Performance workstream.

Reliability Roadmap v2 Phase 0 Development Quality Gate, Phase A Field QA Foundation, Phase B Operational Visibility, and Phase C Deep Field Verification are complete. Within Phase B, B1 System Health Dashboard, B2 Runtime Incident Feed, and B3 Health Aggregation are complete and production-verified. C3 authenticated CMS verification remains a deliberate manual protected operation and must not be coupled back into normal Worker production releases without new explicit scope.

Production environment retirement follow-ups are complete and operator-verified as of 2026-09-11. Live Vercel Production uses server-only `COMPLAINT_API_URI`; retired `VITE_COMPLAINT_API_URI` is absent from the live Vercel environment; and legacy-only CMS-auth environment values are retired from the applicable Vercel/Cloudflare environments. Compatibility parsing in server source is not evidence that a retired value is still configured.

The v3.3.2 Admin editor bundle and Tiptap/ProseMirror dependency-isolation checks are current regression gates. Do not weaken their thresholds merely to make CI green.

M13-M21 and the previous post-P5H project-state note are historical migration/stabilization snapshots. Do not report them as the current active phase or canonical current status.

## Current Source Of Truth

Use these files as current references:

- `docs/architecture/current-project-state.md` — canonical current project/release state.
- `docs/releases/v3.3.2-release-baseline.md` — v3.3.2 released performance baseline and verification evidence.
- `docs/workstreams/v3.3.2-content-editor-performance-tracker.md` — closed v3.3.2 workstream execution record.
- `docs/architecture/current-runtime-ownership.md` — current runtime ownership and branch/deployment boundaries.
- `docs/deployment/runtime-deployment-guide.md` — current deployment behavior.
- `docs/development/environment-variables.md` — current environment-variable ownership.
- `docs/operations/environment-retirement-verification-2026-09-11.md` — operator-verified complaint/CMS-auth environment retirement state.
- `docs/architecture/reliability-roadmap-v2.md` — completed reliability phase definitions and evidence.
- `docs/operations/phase-a-field-qa-foundation.md` — current Production Verification browser-QA ownership.
- `docs/operations/phase-b-operational-visibility.md` — completed Phase B/B1-B3 scope and current consolidated ownership.
- `docs/operations/phase-c-deep-field-verification.md` — completed Phase C and current manual C3 operation boundary.
- `docs/operations/d1-recovery-drill.md` — current read-only D1 recovery-drill path.
- `docs/admin/admin-ux-execution-tracker.md` — completed Admin UX sequence.
- `AGENTS.md` — repository-wide agent operating rules.

`docs/architecture/post-p5h-current-project-state.md` and dated M13-M21/migration/audit documents remain historical evidence; they do not override the current source-of-truth files above.

## Current Runtime Ownership

- Public structured reads: Cloudflare Worker and D1.
- Public analytics, site view, content view, visitor presence, and live visitor stats: Cloudflare Worker and D1.
- B2 Runtime Incident Feed ingest and protected aggregates: Cloudflare Worker and D1.
- Admin structured reads and writes: Cloudflare Worker and D1.
- Admin user access: Cloudflare RBAC plus D1 `app_admin_users`.
- Admin session proxy: Vercel server-side proxy.
- B3 Health Aggregation: Vercel server-owned `/api/health-aggregation`, explicit refresh only, reading public GitHub workflow/commit-status metadata from current `main`.
- Media/file bridge: Apps Script behind the Vercel proxy.
- File storage: Google Drive.
- Complaint submission: Vercel `/api/complaint` to the dedicated Complaint Apps Script, configured by live server-only `COMPLAINT_API_URI`.

## Current Feedback And UX Standards

- Admin write operations use blocking loading modals while pending, centered success modals requiring acknowledgment, centered error modals requiring acknowledgment, and no short auto-dismiss final-result success toast.
- This standard applies to Media, Content, Documents, Menu, Users, Calendar, Carousel, E-Service, and Settings.
- Urgent marquee speed is normalized by pixels per second with distance-based duration. Reduced motion slows the ticker instead of disabling it.

## Reliability Boundaries

- Reuse `X-RCAT-Request-ID`; do not create a parallel request-correlation identifier.
- `.github/workflows/production-verification.yml` owns deployment-driven read-only production browser QA plus consolidated scheduled P6B security and P6C reliability checks.
- P6A owns D1 utilization observability and remains manual-only and protected-Environment approval-gated through Production Verification operation `observability`.
- P6B owns security/WAF/CSP/rate-limit contracts; explicit auth anomaly diagnosis uses Production Verification operation `auth-anomaly`.
- P6C owns the bounded six-hour SSR → Worker → D1 reliability guard through Production Verification.
- Phase B B1/B2/B3 are complete. B3 is server-owned explicit-refresh aggregation through `/api/health-aggregation`; do not add browser infrastructure credentials or background polling.
- Phase C is complete; C3 is manual-only through `.github/workflows/production-data-operations.yml` operation `authenticated-cms-field`.
- Read-only D1 recovery readiness lives in `.github/workflows/maintenance-recovery.yml`; destructive restore remains incident-only.
- Do not add a duplicate paid observability stack merely to recreate existing guards.
- New reliability work requires an explicit new scope; do not silently reopen completed phases.

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
- M20/M21/post-P5H active-phase wording in current-facing guidance.
- Retired branch-mutating `format-guard.yml`.
- Retired duplicate/phase-specific workflows such as `phase-a-production-browser-smoke.yml`, `phase-c3-authenticated-cms-field.yml`, `p6b-production-security.yml`, `p6c-production-reliability.yml`, `production-observability.yml`, and `d1-recovery-drill.yml`.
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
