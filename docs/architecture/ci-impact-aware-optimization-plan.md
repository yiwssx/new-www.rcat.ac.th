# RCAT CI/CD Change-Impact Optimization — Implementation Plan

Status: **PLAN ONLY** — tracking issue [#739](https://github.com/yiwssx/new-www.rcat.ac.th/issues/739)  
Date: 2026-10-28  
Repository: `yiwssx/new-www.rcat.ac.th`  
Owner: tracked in GitHub Issue #739

> This document is the approved *planning baseline*, not an implementation of selective CI. No runtime behavior, workflow trigger, branch protection, authentication, Worker/D1 migration, or Vercel deployment setting is modified by this planning change. Implement subsequent work through separate reviewed PRs. This work is independent of the discontinued React/Astro experiment #655; it must not reopen that experiment.

## 1. Problem statement

Current [CI](../../.github/workflows/ci.yml) runs for both `pull_request` to `main` and `push` to `main`. A dependency preflight precedes broad dependency, static quality, unit, integration, build, governance, Worker, and functional E2E lanes. The required `quality` aggregate currently insists every upstream lane is `success`. This is conservative but causes irrelevant work for isolated changes and runs broad checks again after merge.

A stale PR is a genuine release risk: a passing PR checked against old `main` does not prove the *combined* code works. We must solve merge safety **before** eliminating post-merge broad tests.

Other confirmed inefficiencies worth profiling:
- Each CI lane sets up Node/pnpm and installs dependencies separately.
- The functional lane installs Playwright/Chromium with system dependencies.
- The governance lane pulls a pinned Docker image and runs security sandbox/preflight.
- `pnpm perf:check` performs a separate in-memory Vite build despite the CI build lane.
- `scripts/check-design-system-governance.mjs` enforces both the full `pnpm quality` check ordering and a dedicated `pnpm design:check` CI invocation.
- Vercel already has branch deployment restrictions and an ignore-build script; do not assume all pushes build there.

**Unknown until P0:** actual time per job, CI critical path, effective branch ruleset/required checks/merge method, Vercel timing and build redundancy. Do not claim a savings percentage without evidence.

## 2. Non-negotiable invariants

1. Retain the GitHub required status/check name `quality` unless an explicitly approved coordinated ruleset migration occurs.
2. Never treat a required-but-skipped/cancelled lane as passing; skips require an authoritative impact plan and reason.
3. Fail closed on unknown paths, detector failures, missing/ambiguous git history, dependency-graph gaps, config changes and renamed/deleted files.
4. Retain critical security/auth tests when `server/cmsAuth/**`, authentication, authorization, cookies/session/MFA, secret handling, or related APIs are affected.
5. Retain Worker/D1 integration and migration safety checks when database schema, migrations, runtime bindings, or shared backend contracts change.
6. Validate the **up-to-date integrated tree** prior to merge; require strict up-to-date checks or correctly configured merge queue. Confirm direct-push and bypass restrictions. Do not disable full `push main` checks before these safeguards exist.
7. Preserve Vercel production build/environment consistency, release identity, health checks, `no-store` on authenticated responses, SSR/SEO/cache behavior, and rollback options.
8. Keep local/manual `pnpm quality` and full regression commands available. Optimize *default CI execution*, not the availability of safety checks.
9. No Astro installation, CMS refactor or React migration as part of this tracker.

## 3. Proposed architecture

```text
PR / merge_group
  -> fast: safe changed-file discovery + risk classification
  -> versioned impact plan (domains, required jobs, reasons, fallback)
  -> required domain tests + mandatory safeguards
  -> stable 'quality' aggregate validates required/executed/skipped
  -> strict pre-merge integration (latest main / merge queue)
  -> merge
  -> Vercel production build/deploy
  -> post-deploy targeted smoke, health and release identity checks
```

Domains (initial): `public-ui`, `admin-ui`, `design-system`, `cms-auth-security`, `worker-d1`, `shared-contracts`, `frontend-build`, `deploy-config`, `dependencies`, `docs-only`, `tests-only`, `unknown`.

### Example impact rules (proposals; require dedicated tests)

| Changed area | Required validation | Lanes not automatically required |
| --- | --- | --- |
| `src/theme.ts`, design tokens, CSS | design governance, affected Public/Admin UI, relevant visual, relevant build | D1 migration, unrelated MFA, full Worker |
| `src/public/**` | affected public unit, SSR/SEO/route, relevant E2E and build | unrelated Admin account workflows |
| `src/admin/**` | affected CMS/editor/permissions UI, relevant integration/build | unrelated Public carousel |
| `server/cmsAuth/**`, session/MFA | critical auth security/unit/coverage/integration, auth E2E | unrelated Public styling |
| `cloudflare/public-api/**` | Worker typecheck, affected Worker/unit/integration, migration checks when relevant | unrelated React visual |
| Shared contracts/utilities | transitive consumers: Public/Admin/Worker as appropriate | must **not** be decided from folder name alone |
| Lockfile, TypeScript/Vite/Vercel/GitHub CI/security configs | broad dependency/type/build/release/security checks | no narrow skip without proven scope |
| Docs-only | format/docs governance | frontend full E2E and Worker deployment dry-run |
| Unknown, detector errors, missing ref base | safe full plan or block | never silently skip |

`vitest --changed` may assist in selecting *affected files*, but must not be the sole authority: it does not exhaustively model dynamic imports, runtime config, SQL migrations, integration tests, Browser/E2E journeys or policy checks.

## 4. Execution and quality aggregation

**Impact detector:** a deterministic version-controlled tool (proposed `scripts/ci/detect-impact.mjs` + `config/ci-impact-map.json`) using a trustworthy changed-file range. On `pull_request`, use the intended merge/base semantics, not an arbitrary `HEAD^`. On `merge_group`, use the queue candidate/integrated tree. The detector emits an auditable JSON plan and human-readable Job Summary.

**Required `quality` contract:** the summary job runs even if a child fails. For each lane:
- Plan requires lane + actual `success` -> pass.
- Plan says lane not needed + actual `skipped` + validated reason -> pass.
- Required but `skipped`/`failure`/`cancelled`/missing -> fail.
- Unexplained `skipped`, invalid plan, detector failure or uncertain base -> fail closed, or apply a tested conservative full-plan fallback.
- Ensure the required GitHub status name stays `quality` and required checks do not stay pending due to workflow-level path filtering.

**Baseline full-run:** keep `workflow_dispatch` full validation and a deliberate scheduled/manual full regression for detection-gap monitoring where justified; do not introduce a second permanent green check disconnected from real coverage.

## 5. Implementation phases (checklist of record is issue #739)

### P0 — Baseline and safety assessment
- Collect recent run/job times, P50/P90, timeout and retry evidence, critical path and Vercel build timing.
- Inspect live branch protection/rulesets, `quality` required status, direct push/bypass, stale-check behavior and merge queue eligibility.
- Record release requirements and rollback procedure.

### P1 — Impact model and test ownership
- Inventory suites and dependencies by Public, Admin, Auth, Shared, Worker, Build, Governance.
- Create conservative impact configuration and file-selection logic.
- Add deterministic test fixtures covering deleted/renamed/shared/unknown paths, docs-only, lockfile changes, stale base and detector failure.

### P2 — Conditional execution and safe quality gate
- Keep the same required `quality` check and introduce an always-running impact detector.
- Run relevant CI lanes; maintain mandatory high-risk gates.
- Validate planned versus actual results and skip reasons. Update the existing design-governance source contracts so selective execution does not fail incorrectly.
- No changes to post-merge behavior yet.

### P3 — Remove duplicated work
- Evaluate artifact reuse for `perf:check` only after proving equivalence with its current sanitized in-memory Vite build.
- Reduce unnecessary installs, repeated browser provisioning, container startup and duplicated validations.
- Preserve independent tests where cache/build settings materially differ.

### P4 — Safe merge and production execution
- Enforce strict up-to-date checks **or** merge queue, including required `merge_group` triggers when relevant.
- Confirm merged commit was validated as the integrated tree; handle direct-push/bypass/fallback paths explicitly.
- Only then reduce `push main` source regression to deploy verification and targeted smoke checks; preserve controlled full regression and release rollback.

### P5 — Metrics, agents and controlled rollout
- Publish impact JSON, skipped-lane rationale, timing, failures and source/commit identity.
- Document agent-safe diagnosis and retry only failed jobs where valid.
- Compare P50/P90 feedback, total runner-minutes, timeout frequency, number of redundant runs, missed regressions and deploy success versus P0 baseline.
- Follow up only if observable gains and release-safety criteria are satisfied.

## 6. Acceptance scenarios

1. Theme color change executes theme/design + affected Public/Admin tests; unrelated D1/MFA/full security sandbox does not run.
2. MFA/auth changes always execute critical auth/security coverage and integration.
3. Shared API contract modifications expand testing to all consumers.
4. Unknown changes, stale git base or broken detector cannot make `quality` green.
5. A PR behind latest `main` cannot merge using only outdated test results.
6. An intentionally skipped lane has a documented validated reason; required jobs still fail closed.
7. Docs-only PR can complete without functional/browser/build/Worker full suites when impact classification is sound.
8. Production build and release health remain correct, with rollback.
9. No CI check-name regression, jobs indefinitely pending, or governance-policy bypass.
10. Real time/cost reduction is measured; no invented targets or benchmark claims.

## 7. Change-control boundaries and references

Planning PR: **this document only**. Implementation to proceed as independent, reviewable PRs for P0–P5; close issue #739 only after verified acceptance criteria.

Primary source files:
- `.github/workflows/ci.yml`
- `.github/actions/setup-project/action.yml`
- `package.json`, `vite.config.ts`, `vitest.critical-coverage.config.ts`
- `scripts/check-public-performance-budget.mjs`
- `scripts/check-design-system-governance.mjs`
- `scripts/vercel-ignore-build.mjs`, `vercel.json`
- `playwright.config.ts`, `playwright.production.config.ts`

**Issue:** https://github.com/yiwssx/new-www.rcat.ac.th/issues/739
