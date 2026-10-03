# Current Project State

Status: **CURRENT**

Updated: 2026-10-03

Default branch: `main`

Current release: `v3.3.1 — Content Operations`

Release commit: `e1c7f0181adff746457e15a6a6d35743f9326763`

## Executive state

The project is in a production-governance and governed-maintenance baseline. There is no active feature-development, migration, release, P6, Reliability Roadmap v2, or Admin UX workstream.

The v3.3.1 Content Operations workstream is complete, production-released, production-verified, tagged, and published. Its completed production operations must not be repeated merely because an older tracker, dated audit, or conversation describes a pre-release checkpoint.

## v3.3.1 closure

- Tasks 1–9 were integrated into `main` by PR #505 at `e1c7f0181adff746457e15a6a6d35743f9326763`.
- Protected Worker production preflight: Deploy / Worker #18, run `37124665532` — PASS.
- Production D1 migrations `0018` and `0019` were applied successfully during the approved release sequence.
- Protected Worker production release: Deploy / Worker #19, run `37124946660` — PASS; migration/deploy completed successfully.
- Production Verification #106, run `37125180446` — PASS against the exact release commit.
- Git tag `v3.3.1` points to the exact release commit.
- GitHub Release `v3.3.1 — Content Operations` is published as a normal release.

## Current runtime and governance baseline

Preserve these established ownership boundaries unless a new explicit scope changes them:

- Public structured reads and public structured application data: Cloudflare Worker + D1.
- Admin structured reads/writes and Admin RBAC data: Cloudflare Worker + D1.
- Admin session proxy: Vercel server-side proxy.
- Public SSR/frontend and same-origin server/proxy routes: Vercel.
- Media/file bridge: Apps Script behind the approved Vercel proxy; file storage remains Google Drive.
- Complaint path: dedicated complaint Apps Script via server-only `COMPLAINT_API_URI`.
- B3 health aggregation: server-owned explicit-refresh `/api/health-aggregation`.
- Request correlation: reuse `X-RCAT-Request-ID`.

Completed production-governance/reliability scope remains closed: P5H, P6B, P6C, P6D, Reliability Roadmap v2 Phase 0/A/B1-B3/C, Admin UX 00-10, and production environment-retirement follow-ups.

Production Observability remains deliberate/manual-only and protected by the production Environment. C3 remains manual-only. P6C retains its bounded ongoing reliability guard under its current runbook.

## Current branch rule

`main` is the current default and production branch. Active workflows and new operational instructions must target `main`.

References to `master` in dated migration, release, milestone, audit, or completion documents describe the branch name that existed when those historical records were written. They are historical evidence and must not override current `main` workflow conditions.

## Ongoing maintenance

Governed Renovate dependency maintenance and narrowly scoped bug fixes may continue. They do not reopen completed feature, reliability, migration, or release phases.

Open Renovate PRs or Dependency Dashboard entries are maintenance state, not evidence that v3.3.1 production release is incomplete. Dependency PRs must become current with `main` and pass the repository-required CI/governance gates before merge.

## Production safety

- Do not repeat v3.3.1 D1 migrations, Worker release, or production verification as a state-reconciliation action.
- Do not mutate production Cloudflare, D1, Vercel, Apps Script, Google Drive, DNS, or protected GitHub environments without a new explicit authorized scope.
- Keep D1 migrations append-only and preserve protected production approvals/release gates.
- Do not restore retired browser-side Apps Script structured-data access, `rcat-public-api-production`, persistent Cloudflare Preview procedures, retired complaint/CMS-auth environment variables, or duplicate monitoring/observability paths.

## Canonical references

- `docs/workstreams/v3.3.1-content-ops-tracker.md` — closed v3.3.1 execution record and release evidence.
- `docs/releases/v3.3.1-release-baseline.md` — v3.3.1 scope and production closure.
- `docs/architecture/current-runtime-ownership.md` — current runtime ownership.
- `docs/deployment/runtime-deployment-guide.md` — current deployment behavior.
- `docs/development/environment-variables.md` — environment-variable ownership.
- `docs/architecture/reliability-roadmap-v2.md` — completed Reliability Roadmap v2 definitions/history.
- `docs/operations/p6a-production-observability.md` — Production Observability constraints.
- `docs/operations/p6b-security-enforcement.md` — completed P6B controls.
- `docs/operations/p6c-recovery-reliability.md` — P6C recovery/reliability and ongoing guard ownership.
- `docs/operations/p6d-product-ux-improvements.md` — completed P6D scope.
- `docs/operations/phase-c-deep-field-verification.md` — completed Phase C and manual-only C3 boundary.
- `docs/admin/admin-ux-execution-tracker.md` — completed Admin UX 00-10 record.

`docs/architecture/post-p5h-current-project-state.md` is the preceding 2026-09-20 project-state snapshot. It remains historical evidence but is superseded by this document for current-state reporting.
