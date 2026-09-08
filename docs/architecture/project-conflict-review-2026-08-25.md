# Project Conflict Review — 2026-08-25

Status: historical conflict-review record. Its deferred Copilot guidance conflict was resolved by the 2026-09-08 project-state cleanup.

This review focused on project-state and maintenance conflicts that could cause future reports or implementation plans to use stale phase language.

## Current Source Of Truth

The current source of truth is no longer the short 2026-08-25 status snapshot. Use:

- `docs/architecture/post-p5h-current-project-state.md`
- `docs/architecture/current-runtime-ownership.md`
- `docs/deployment/runtime-deployment-guide.md`
- `docs/architecture/reliability-roadmap-v2.md`
- `docs/operations/phase-b-operational-visibility.md`
- `docs/operations/phase-c-deep-field-verification.md`
- `docs/admin/admin-ux-execution-tracker.md`
- `README.md`
- `AGENTS.md`

The 2026-08-25 project-state wording below is preserved only as the context in which this conflict review was originally performed.

```text
post-P5H production governance baseline + governed dependency maintenance + Admin UX 00-10 completed
```

## Conflicts Found

### 1. M19/M20 readiness tests forced stale M21-open wording

The historical readiness tests still expected `M21: OPEN` and `M21 owns remaining UI/UX`, even after project-state docs were updated to say M21 is no longer current.

Resolution: updated the readiness tests to expect `M21: SUPERSEDED` and to verify that the M21-era scope was replaced by the post-P5H baseline.

### 2. Historical readiness helper emitted active-looking M21 wording

The M20 readiness helper still listed `M21 UI/UX and logic stabilization` as a future production responsibility. That wording was valid in the historical M20/M21 context, but it looked like an active project status when surfaced in later reports.

Resolution: changed the helper output to describe that item as post-M20 historical evidence superseded by the post-P5H baseline.

### 3. Compatibility markers and current reporting rules were mixed together

`docs/architecture/current-migration-status.md` retained compatibility markers for older readiness gates in the same document that now warns against using migration-era status as current state.

Resolution: separated the compatibility markers into a clearly named historical section and removed the active-looking `M21: OPEN` marker.

## Guardrail After This Change

Future project reports must not describe P6 or M21 as the current project phase unless a newer explicit project-state document reopens that phase.

The canonical status wording has evolved since this 2026-08-25 review. Use `docs/architecture/post-p5h-current-project-state.md` rather than copying the historical status sentence from this file.

## Validation Path

This cleanup had to pass the existing CI lanes before merge. The change intentionally updated historical readiness tests together with the documentation they protected so the repository gates reflected the post-P5H baseline instead of preserving stale active-phase wording.

## Deferred Conflict — Resolved 2026-09-08

The original review deferred `.github/copilot-instructions.md` because an earlier `.github/` change caused pull-request CI to fail before job steps were created. That deferred conflict is no longer open.

The 2026-09-08 project-state cleanup updated `.github/copilot-instructions.md` to use the canonical post-P5H project state, current runtime/deployment ownership, and Reliability Roadmap v2. It also added `src/test/projectStateConsistency.test.ts` so current-facing guidance cannot silently revert to active-looking M20/M21 wording.

See `docs/architecture/project-state-conflict-cleanup-2026-09-08.md` for the reconciliation record.

## Scope Safety

The 2026-08-25 review changed no runtime behavior, API contract, Worker/D1 resources, migrations, Apps Script code, Vercel routing or environment variables, authentication/session behavior, RBAC policy semantics, persistence behavior, package manifests, or lockfile. The 2026-09-08 follow-up likewise changes project-state guidance/tests only; it does not reopen historical milestones or introduce new runtime scope.
