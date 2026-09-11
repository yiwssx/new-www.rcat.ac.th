# Current Migration Status

Status: historical / superseded snapshot.

Updated: 2026-09-11.

This document was originally the migration-era status ledger for M13-M21. It is no longer the current project-state source of truth. Historical compatibility markers below are retained as evidence only.

Use these current documents first:

- `docs/architecture/post-p5h-current-project-state.md`
- `docs/architecture/current-runtime-ownership.md`
- `docs/deployment/runtime-deployment-guide.md`
- `docs/development/environment-variables.md`
- `docs/operations/environment-retirement-verification-2026-09-11.md`
- `docs/admin/admin-ux-execution-tracker.md`
- `README.md`
- `AGENTS.md`

## Superseding Current Project State

Current status is no longer an M-series migration/stabilization status. The superseding status is:

```text
post-P5H production governance baseline + Production Observability configured/approval-gated + P6B Security Enforcement completed + P6C Recovery & Reliability completed + P6D Product/UX Improvements completed + governed dependency maintenance + Admin UX 00-10 completed + Reliability Roadmap v2 complete (Phase 0 + Phase A + Phase B/B1-B3 + Phase C complete) + production environment retirement follow-ups completed/operator-verified (2026-09-11)
```

There is no active P6 feature-development phase and no active Reliability Roadmap v2 implementation phase. The live environment-retirement state is also closed: Vercel Production uses `COMPLAINT_API_URI`, retired `VITE_COMPLAINT_API_URI` is absent from the live Vercel environment, and legacy-only CMS-auth environment values are retired from the applicable Vercel/Cloudflare environments.

Governed Renovate dependency maintenance may continue when it follows the repository dependency policy and passes CI/governance gates.

## Historical Migration Summary

The migration-era milestones remain useful as historical evidence only:

- M13-M19: migration, parity, preview, and repository-owned remediation history.
- M20: migration/runtime/domain-cutover scope closed.
- M21: UI/UX and logic stabilization history after M20.

M21 must not be reported as open, active, current, or next unless a newer explicit project-status document reopens it.

## Historical Readiness Compatibility Markers

The following lines are retained only for older M19/M20 readiness tests and historical evidence compatibility. They are not current project-state instructions, and they must not be used in status reports or future implementation plans.

```text
M19: `CLOSED` for repository-owned parity remediation.
M20: `CLOSED` for migration/runtime/domain-cutover scope.
M21: `SUPERSEDED` historical UI/UX and logic stabilization snapshot.
```

Historical interpretation:

- `M19: CLOSED` records the repository-owned parity remediation closeout from the migration era.
- `M20: CLOSED` records that migration/runtime/domain-cutover ownership closed before the post-P5H baseline.
- `M21: SUPERSEDED` records that the old M20/M21-era stabilization snapshot must not be treated as an open project phase.

Historical M20/M21 wording is deliberately superseded: the M21-era stabilization scope was replaced by the post-P5H production governance baseline and the completed Admin UX 00-10 tracker. Current reporting must use `docs/architecture/post-p5h-current-project-state.md`.

## Runtime Ownership Summary

Current runtime ownership is no longer derived from the M13-M21 narrative in this file. Use `docs/architecture/current-runtime-ownership.md` for authoritative runtime boundaries and `docs/deployment/runtime-deployment-guide.md` for operational deployment commands.

At the current baseline:

- Public structured reads: Cloudflare Worker + D1.
- Public analytics and visitor stats: Cloudflare Worker + D1.
- B2 runtime-incident ingest and protected aggregates: Cloudflare Worker + D1.
- Admin structured reads and writes: Cloudflare Worker + D1.
- CMS identity, sessions, RBAC, MFA, CSRF, step-up assurance, session revocation, and user lifecycle: Cloudflare Worker + D1 through same-origin Vercel proxies.
- B3 Health Aggregation: Vercel server-owned `/api/health-aggregation`, explicit refresh only.
- Media/file bridge: Apps Script behind the authenticated Vercel proxy.
- Complaint submission: same-origin Vercel `/api/complaint` to the dedicated Complaint Apps Script using live server-only `COMPLAINT_API_URI`.
- File storage: Google Drive behind the Apps Script media bridge.

Compatibility provider markers retained for M20 evidence gates:

```text
Admin structured data provider: Cloudflare.
Public client data provider: Cloudflare.
Media/attachment/file provider: Google Drive via Apps Script bridge.
Database provider: D1.
Production custom domain: `www.rcat.ac.th` connected to Vercel production.
```

These provider markers remain compatible with current runtime ownership but should be read together with `docs/architecture/current-runtime-ownership.md` for complete boundaries.

## Reporting Rule

Status reports and future implementation plans must not describe P6, M21, or Reliability Roadmap v2 Phase B as the current active project phase.

Use the canonical wording from `docs/architecture/post-p5h-current-project-state.md` rather than dated M13-M21 milestone text.

## Safety

This documentation reconciliation changes no runtime behavior, API contract, Worker/D1 resources, migrations, Apps Script code, Vercel routing or environment values, authentication/session behavior, RBAC policy semantics, persistence behavior, package manifests, or lockfile. It records and guards the current state only.
