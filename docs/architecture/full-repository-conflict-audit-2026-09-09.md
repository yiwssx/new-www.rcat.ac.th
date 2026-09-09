# Full Repository Conflict Audit — 2026-09-09

Status: complete.

Canonical project state remains `docs/architecture/post-p5h-current-project-state.md`. This audit does not reopen historical M13-M21 phases or completed P6B/P6C/P6D work.

## Scope

The audit covered:

- current-facing project-state and runtime-ownership guidance;
- dependency policy, lockfile, generated dependency status, and security audit;
- Node/pnpm toolchain pins and current development guidance;
- GitHub Actions workflows, including completed-phase and protected production workflows;
- obsolete or explicitly unreferenced repository files;
- open pull requests, open issues, and branch state;
- compatibility surfaces that might look removable but still have an active consumer or backward-compatibility role.

## Remediated

### Dependency security and generated state

Two newly disclosed high-severity findings were identified in the development/tooling tree while the production dependency tree remained clean:

- `wrangler -> miniflare -> sharp 0.35.2`, fixed by the narrow `sharp@<0.35.4 -> 0.35.4` override;
- `@commitlint/cli -> @commitlint/load -> cosmiconfig -> js-yaml 4.3.1`, fixed by the narrow `js-yaml@>=4.0.0 <4.3.2 -> 4.3.2` override.

The lockfile and `docs/maintenance/dependency-current-status.md` were regenerated from the repository toolchain. The final report records zero low, moderate, high, or critical findings for both the full tree and production tree.

The diagnostic workflow used to expose audit JSON and the temporary workflow used to regenerate cleanup state were removed before their corresponding cleanup PRs merged. No temporary cleanup/diagnostic workflow remains in `master`.

Renovate PR #260 subsequently updated `@playwright/test` from `^1.62.1` to `^1.63.0` and merged at `a69e82be0fbc7bb4b1e95c23b1eed9c365d00a80`. Protected-master Dependency Status Sync run #53 correctly detected the resulting 12-line generated snapshot drift without writing directly to protected `master`. PR #263 regenerated and committed that snapshot through the normal pull-request path.

Final generated dependency state after PR #263:

- direct dependencies: 52;
- accepted by live monitoring policy: 43;
- full-tree security audit: PASS, zero vulnerabilities;
- production security audit: PASS, zero vulnerabilities;
- `@playwright/test`: `1.63.0`, registry latest at generation time;
- dependency freshness and dependency-document audit gates: PASS.

### Toolchain documentation drift

`.node-version` is `24.20.0`, `engines.node` remains `24.x`, and pnpm is pinned to `10.34.5`.

Current development guidance that incorrectly referenced Node `24.18.0` was updated by PR #261. `src/test/repositoryHygieneConsistency.test.ts` guards this contract so a future Node pin change must update current guidance in the same change.

Historical measurements that mention older Node versions remain unchanged because they are evidence of earlier states, not current toolchain instructions.

### Obsolete sitemap generator

`scripts/generate-sitemap.mjs` was explicitly documented as obsolete and unreferenced. Current sitemap ownership is the Vercel runtime function `api/sitemap.mjs`; `pnpm build` does not generate `public/sitemap.xml`.

The obsolete build-time generator was deleted by PR #261. The hygiene regression test requires runtime sitemap ownership to remain single-sourced and requires the old generator to stay absent.

### Phase A production-smoke concurrency race

Post-merge verification of PR #261 exposed a workflow race that static repository inspection could not reveal. `.github/workflows/phase-a-production-browser-smoke.yml` used one global concurrency group while `workflow_run` fires after CI completes on every branch.

A successful PR or Renovate CI could therefore create a Phase A workflow run that was correctly skipped by the job-level `master` condition but still entered the same workflow-level concurrency group first. With `cancel-in-progress: true`, that skipped run could cancel an in-flight read-only production smoke for `master` before browser assertions completed.

PR #263 scopes concurrency to the triggering CI source branch while preserving same-branch supersession. `src/test/phaseAAutomationContract.test.ts` rejects a return to the old global concurrency key. The production base-URL environment variable, artifact paths, and field-QA summary remain unchanged.

Production verification after merge proved the fix: Phase A Production Browser Smoke run #148 (`34309509904`) targeted master SHA `23ff37f80b0b0eda7fe0d1f16141bb4d52ed1ce6`, matched a successful Vercel production deployment, executed the read-only browser suite, and completed successfully without cross-branch cancellation.

PR #262 was the initial follow-up review object. GitHub closed it automatically when its head branch was deliberately reset to the then-current `master` before the cleaned changes were reapplied. PR #263 replaced it and contains the final reviewed follow-up change.

## Current-state conflict review

The current-facing state contract is consistent:

- Phase 0: complete;
- Phase A: complete;
- Phase B: active because B3 Health Aggregation remains planned;
- B1 System Health Dashboard: complete;
- B2 Runtime Incident Feed: complete and production-verified;
- Phase C: complete;
- C3: production-verified and manual/protected only after closure;
- M13-M21: historical evidence, not active project phases;
- P6B, P6C, P6D and Admin UX 00-10: complete;
- governed dependency maintenance continues independently of feature-phase status.

`src/test/projectStateConsistency.test.ts` rejects stale active M20/M21 wording from current-facing guidance and protects the B1/B2/B3/Phase C contract. The full PR #263 and post-merge master unit-test lanes passed with these guards enabled.

## Historical records intentionally retained

Historical milestone, cutover, readiness, smoke, and audit documents were not deleted merely because they contain wording that was true at an earlier date. Files marked as archived, historical, superseded, closure evidence, or compatibility evidence remain part of the audit trail.

Old M20/M21 handoff wording must not be interpreted as current state. `docs/architecture/m20-cleanup-ledger.md` and `docs/architecture/m20-cleanup-runtime-ownership.md` now explicitly identify themselves as historical records/snapshots and point to the canonical post-P5H project-state document.

## Workflow review

No current workflow was identified as safe to delete solely because its originating implementation phase is complete.

Retained operational workflows include:

- CI and Format Guard;
- dependency monitoring and dependency-status synchronization;
- Phase A production browser smoke as the production read-only browser verification path;
- C3 authenticated CMS field verification as manual, master-only, protected production verification;
- P6B/P6C production security and reliability monitoring;
- D1 recovery drill and production observability workflows;
- Worker and Apps Script protected release/preflight/rollback workflows;
- Facebook metadata reclassification, which remains a protected production audit/apply tool rather than an abandoned one-time workflow.

The retired Worker-to-C3 automatic dispatch and the one-time C3 dispatcher remain absent. They must not be restored without a new explicit design decision.

## Compatibility surfaces intentionally retained

`VITE_PUBLIC_ANALYTICS_STRATEGY="both"` remains a deprecated compatibility alias for the canonical GTM transport. It is covered by code, types, documentation, and tests. Repository evidence does not prove that all external deployment environments have stopped using the alias, so removing it during cleanup would be an unjustified compatibility break.

`usePublicCmsSnapshot` remains actively consumed by the public menu compatibility fallback and therefore is not dead code.

## Closure evidence

- PR #261 merged at `3fda60f7126da78d624726c981822e061e554567` after PR CI #1971 passed; post-merge master CI #1972 passed and Vercel reported success.
- Renovate PR #260 rebased onto the remediated master, passed PR CI #1974, and merged at `a69e82be0fbc7bb4b1e95c23b1eed9c365d00a80`; master CI #1979 passed.
- Protected-master Dependency Status Sync #53 detected the expected Playwright-generated snapshot drift and left protected `master` untouched.
- PR #263 passed CI #1983 in every lane, including Unit Tests, Functional E2E, Governance, Static Quality, Build, Integration Tests, Worker, Dependencies, and the aggregate `quality` gate; it had no unresolved review threads.
- PR #263 merged at `23ff37f80b0b0eda7fe0d1f16141bb4d52ed1ce6`.
- Post-merge master CI #1984 (`34309272452`) passed every lane and the aggregate `quality` gate.
- Vercel status for `23ff37f80b0b0eda7fe0d1f16141bb4d52ed1ce6` reported success.
- Phase A Production Browser Smoke #148 (`34309509904`) completed successfully against that exact master SHA after matching the Vercel production deployment.
- Final generated dependency status records zero vulnerabilities in both full and production trees and accepted status for 43/52 direct dependencies.
- Temporary audit and snapshot-refresh workflows are absent from the merged repository.
- Immediately before opening this documentation-only closure change, the repository had zero open pull requests and zero open issues.

## Closure result

All remediation and validation criteria defined by this audit are satisfied. No current-facing project-state conflict, known cleanup-only dead file, temporary cleanup workflow, unresolved cleanup review thread, failing dependency/security gate, failing master CI lane, failing Vercel status, or failing Phase A production browser verification remains from this audit.

This document is the terminal record for the 2026-09-09 full-repository conflict and hygiene cleanup. Its documentation-only merge is validated through the normal repository CI path; that self-validation does not reopen the completed remediation scope or require another self-referential closure edit.
