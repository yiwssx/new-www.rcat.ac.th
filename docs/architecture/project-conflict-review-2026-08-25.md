# Project Conflict Review — 2026-08-25

Status: resolved in this change.

This review focuses on project-state and maintenance conflicts that could cause future reports or implementation plans to use stale phase language.

## Current Source Of Truth

Current project status is:

```text
post-P5H production governance baseline + governed dependency maintenance + Admin UX 00-10 completed
```

The authoritative current-state documents are:

- `docs/architecture/post-p5h-current-project-state.md`
- `docs/architecture/current-runtime-ownership.md`
- `docs/deployment/runtime-deployment-guide.md`
- `docs/admin/admin-ux-execution-tracker.md`
- `README.md`
- `AGENTS.md`

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

Use this wording instead:

```text
Current status: post-P5H production governance baseline. Admin UX 00-10 is complete. Ongoing dependency work is governed maintenance.
```

## Validation Path

This cleanup must pass the existing CI lanes before merge. The change intentionally updates historical readiness tests together with the documentation they protect so the repository gates reflect the current baseline instead of preserving stale active-phase wording.

## Deferred Conflict

`.github/copilot-instructions.md` also contains older M20/M21 wording, but updating files under `.github/` caused pull-request CI to fail before any job steps or logs were created in the first cleanup branch. That change should be handled separately only after confirming the repository policy for `.github/` updates.

## Scope Safety

This review and cleanup change no runtime behavior, API contract, Worker/D1 resources, migrations, Apps Script code, Vercel routing or environment variables, authentication/session behavior, RBAC policy semantics, persistence behavior, package manifests, or lockfile.
