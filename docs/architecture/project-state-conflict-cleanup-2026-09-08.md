# Project-State Conflict Cleanup — 2026-09-08

Status: cleanup reconciliation record.

## Purpose

This pass removes active-looking project-state contradictions without deleting milestone evidence that is intentionally retained as history.

The canonical current state is `docs/architecture/post-p5h-current-project-state.md`.

## Conflicts Resolved

1. `.github/copilot-instructions.md` still described M21 as the active owner of remaining UI/UX and logic work and pointed AI tooling at M20/M21-era files as current sources of truth. It now uses the post-P5H baseline, current runtime/deployment docs, and Reliability Roadmap v2.
2. Phase B documentation described B2 Runtime Incident Feed as pending even though its implementation, repository CI, Worker production release, and Phase A production browser verification had already succeeded. B2 is now recorded as complete and production-verified; B3 Health Aggregation is the only planned Phase B roadmap item.
3. Current-facing release, launch, feature, seed, and smoke-test guidance still contained active-looking M20/M21/cutover wording. Those files now defer to the canonical post-P5H state instead of reopening historical phases.
4. Governed Renovate PR #254 was the remaining open dependency-maintenance PR and was merged after its required checks passed.
5. A repository test now guards current-facing guidance against reintroducing stale active M20/M21 wording and checks the B1/B2/B3 and Phase C status contract.

## Historical Records

M13-M21 architecture, readiness, migration, cutover, and stabilization records remain in the repository when they preserve evidence for their original checkpoints. Historical wording inside those records is not current project status.

Do not delete historical migration evidence merely to make code search return zero M20/M21 matches. Instead, current-facing files must clearly defer to the canonical state and automated consistency checks must prevent historical wording from escaping back into current guidance.

## Current Reliability Interpretation

- Phase 0 Development Quality Gate: complete.
- Phase A Field QA Foundation: complete.
- Phase B Operational Visibility: active.
  - B1 System Health Dashboard: complete.
  - B2 Runtime Incident Feed: complete and production-verified.
  - B3 Health Aggregation: planned.
- Phase C Deep Field Verification: complete.
  - C3 remains manual/protected after closure and is not automatically dispatched by normal Worker production releases.

## B2 Completion Evidence

- PR #217 implementation merge: `76ca0be1c17715b9e6cc2ec71de8d8e7eef81ea4`.
- Repository CI: run `33730760569`, success.
- Phase A Production Browser Smoke: run `33731028288`, success.
- PR #218 canonical Worker release merge: `51d286ddebbe0f05b5ddb21af601768ba0e472c3`.
- Worker Production Release: run `33731760770`, success.
- Follow-up Phase A Production Browser Smoke: run `33732058524`, success.

## Guardrail

Current-facing project guidance must not use `M21 owns remaining`, `M21 stabilization is open`, or equivalent Thai wording as current status. Current-facing reliability guidance must report Phase B as active with B1/B2 complete and B3 planned, and Phase C as complete unless a newer explicit project-state decision changes that contract.
