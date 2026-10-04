# Current Project State

Status: **CURRENT**

Updated: 2026-10-04

Default branch: `main`

Current release: `v3.3.2 — Content Editor Performance`

Release commit: `2ec76e8bd4a58578145f1308641a7b77b4db56b1`

## Executive state

The project is in a production-governance and governed-maintenance baseline. There is no active feature-development, migration, release, P6, Reliability Roadmap v2, Admin UX, or Content Editor Performance workstream.

The v3.3.2 Content Editor Performance workstream is complete, production-released, production-verified, tagged, and published. Its completed deployment and verification must not be repeated merely because an older tracker, dated audit, or conversation describes a pre-release checkpoint.

The preceding v3.3.1 Content Operations release also remains complete. Its D1 migrations `0018` and `0019` and matching Worker production release must not be repeated as part of later state reconciliation.

## v3.3.2 closure

- Tasks 1–9 were integrated sequentially through PRs #510–#518 and the verified integration branch.
- Final integration PR #520 passed the repository release-candidate CI and merged into `main` at `2ec76e8bd4a58578145f1308641a7b77b4db56b1`.
- Main CI #3255, run `37187823374` — PASS against the exact release commit.
- Vercel production deployment for the exact release commit completed successfully.
- Production Verification #117, run `37188044774` — PASS against the exact release commit.
- Authenticated Admin editor smoke was operator-verified on 2026-10-04 without saving or mutating production content: `/admin/content`, create/edit dialog loading, rich-text toolbar, advanced capability loading, and media-picker loading all passed.
- Git tag `v3.3.2` points to the exact release commit.
- GitHub Release `v3.3.2 — Content Editor Performance` is published as a normal release.
- The release required no D1 migration, production Worker deployment, Apps Script deployment, or production data mutation.

## Current runtime and governance baseline

Preserve these established ownership boundaries unless a new explicit scope changes them:

- Public structured reads and public structured application data: Cloudflare Worker + D1.
- Admin structured reads/writes and Admin RBAC data: Cloudflare Worker + D1.
- Admin session proxy: Vercel server-side proxy.
- Public SSR/frontend and same-origin server/proxy routes: Vercel.
- Media/file bridge: Apps Script behind the approved Vercel proxy; file storage remains Google Drive.
- Complaint path: dedicated complaint Apps Script via server-only `COMPLAINT_API_URI`.
- B3 health aggregation: server-owned explicit-refresh `/api/health-aggregation`; GitHub workflow/deployment metadata is read from the current `main` branch.
- Request correlation: reuse `X-RCAT-Request-ID`.

Completed production-governance/reliability scope remains closed: P5H, P6B, P6C, P6D, Reliability Roadmap v2 Phase 0/A/B1-B3/C, Admin UX 00-10, production environment-retirement follow-ups, v3.3.1 Content Operations, and v3.3.2 Content Editor Performance.

Current operational ownership is consolidated rather than phase-specific:

- `.github/workflows/production-verification.yml` owns automatic post-CI browser verification plus the scheduled P6B security and P6C reliability checks.
- Production Observability remains deliberate/manual-only as Production Verification operation `observability`, protected by the `production` Environment.
- C3 remains deliberate/manual-only as Production Data Operations operation `authenticated-cms-field`, protected by the `production` Environment and deterministic cleanup.
- `.github/workflows/maintenance-recovery.yml` owns the read-only D1 recovery drill path; destructive restore remains incident-only.
- Retired phase-specific workflow files and the retired branch-mutating Format Guard must not be restored merely because historical documents mention them.

## Current branch rule

`main` is the current default and production branch. Active workflows, runtime GitHub metadata lookups, and new operational instructions must target `main`.

References to `master` in dated migration, release, milestone, audit, or completion documents describe the branch name that existed when those historical records were written. They are historical evidence and must not override current `main` workflow conditions.

## Ongoing maintenance

Governed Renovate dependency maintenance and narrowly scoped bug fixes may continue. They do not reopen completed feature, reliability, migration, or release phases.

Open Renovate PRs or Dependency Dashboard entries are maintenance state, not evidence that the v3.3.2 production release is incomplete. Dependency PRs must become current with `main` and pass the repository-required CI/governance gates before merge.

The v3.3.2 Admin editor bundle and dependency-isolation governance remain active regression gates. Future editor changes must preserve the current behavior/data contracts and satisfy those measured budgets rather than weakening thresholds to make CI pass.

## Production safety

- Do not repeat the v3.3.2 Vercel deployment or production verification as a state-reconciliation action.
- Do not repeat the v3.3.1 D1 migrations `0018`/`0019` or its Worker production release.
- Do not mutate production Cloudflare, D1, Vercel, Apps Script, Google Drive, DNS, or protected GitHub environments without a new explicit authorized scope.
- Keep D1 migrations append-only and preserve protected production approvals/release gates.
- Do not restore retired browser-side Apps Script structured-data access, `rcat-public-api-production`, persistent Cloudflare Preview procedures, retired complaint/CMS-auth environment variables, or duplicate monitoring/observability paths.

## Canonical references

- `docs/workstreams/v3.3.2-content-editor-performance-tracker.md` — closed v3.3.2 execution record and release evidence.
- `docs/releases/v3.3.2-release-baseline.md` — v3.3.2 scope, measured editor-performance baseline, and production closure.
- `docs/workstreams/v3.3.1-content-ops-tracker.md` — closed v3.3.1 execution record and release evidence.
- `docs/releases/v3.3.1-release-baseline.md` — preceding v3.3.1 Content Operations release baseline.
- `docs/architecture/current-runtime-ownership.md` — current runtime ownership.
- `docs/deployment/runtime-deployment-guide.md` — current deployment behavior.
- `docs/development/environment-variables.md` — environment-variable ownership.
- `docs/architecture/reliability-roadmap-v2.md` — completed Reliability Roadmap v2 definitions/history.
- `docs/operations/p6a-production-observability.md` — Production Observability constraints.
- `docs/operations/p6b-security-enforcement.md` — completed P6B controls.
- `docs/operations/p6c-recovery-reliability.md` — P6C recovery/reliability and ongoing guard ownership.
- `docs/operations/phase-a-field-qa-foundation.md` — current consolidated browser-verification ownership.
- `docs/operations/phase-b-operational-visibility.md` — current B1/B2/B3 operational ownership.
- `docs/operations/phase-c-deep-field-verification.md` — completed Phase C and current manual C3 operation boundary.
- `docs/operations/d1-recovery-drill.md` — current read-only D1 recovery-drill procedure.
- `docs/operations/p6d-product-ux-improvements.md` — completed P6D scope.
- `docs/admin/admin-ux-execution-tracker.md` — completed Admin UX 00-10 record.

`docs/architecture/post-p5h-current-project-state.md` is the preceding 2026-09-20 project-state snapshot. It remains historical evidence but is superseded by this document for current-state reporting.
