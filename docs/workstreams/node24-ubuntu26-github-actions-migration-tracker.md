# Node.js 24 LTS and Ubuntu 26.04 migration

**Status:** ACTIVE (planning and evidence gathering)
**Priority:** P0 (shared CI/CD infrastructure)
**Updated:** 2026-10-25 (Asia/Bangkok)
**Issue:** [#717](https://github.com/yiwssx/new-www.rcat.ac.th/issues/717)
**Planning PR:** [#718](https://github.com/yiwssx/new-www.rcat.ac.th/pull/718)
**Baseline main:** `6ff069420b56977b1b189f7a54aa8dbdc701f25b`

## Objective

Move every active GitHub-hosted Ubuntu Actions job to explicit `ubuntu-26.04`.
Update the CI Node.js 24 LTS patch from `24.20.0`, initially targeting `24.22.1`.
Keep Vercel Node `24.x` and the pnpm `10.34.5` toolchain unchanged.
Preserve all required quality checks, production approvals, security isolation, and rollback paths.

GitHub's `ubuntu-latest` transition runs from 2026-10-19 to 2026-11-19.
That is not a published retirement date for the explicit `ubuntu-24.04` image.
Use `ubuntu-24.04` only as a temporary fallback while GitHub supports it.

## Confirmed baseline

- Vercel project `new-www.rcat.ac.th` runs Node `24.x`.
- READY deployment `dpl_Bx5GSyAKTf21KxiUcgQr73Q5qF3a` used pnpm `10.34.5`.
- `.node-version` is `24.20.0`; `package.json` declares Node `24.x` and pnpm `10.34.5`.
- Composite setup uses `actions/setup-node@v7` and `pnpm/action-setup@v6`.
- CI has ten Ubuntu jobs, including aggregate required check `quality`.
- CI runs native dependency installation, Vite builds, Playwright, Wrangler, and Docker security checks.
- The migration inventory includes eleven active `ubuntu-latest` workflow files.
- No Ubuntu 26 compatibility tests have been completed.

## Workflow inventory

- `ci.yml`: all ten jobs, including the `quality` aggregation gate.
- `dependency-status-sync.yml`: registry monitoring and snapshot repair.
- `maintenance-recovery.yml`: Actions cleanup and protected recovery readiness.
- `security-audit-preflight.yml`: offline, read-only Docker security preflight.
- `production-verification.yml`: browser QA, WAF, CSP, and reliability checks.
- `production-data-operations.yml`: controlled CMS and D1 operations.
- `image-production-worker.yml`: image Worker validation and deploy.
- `worker-production.yml`: protected Worker preflight and release.
- `worker-production-rollback.yml`: protected Worker runtime rollback.
- `apps-script-production-release.yml`: protected Apps Script release.
- `apps-script-production-rollback.yml`: protected Apps Script rollback.

Paths above are under `.github/workflows/`.
Count every `runs-on` job rather than only filenames.
Recheck the live inventory before each PR to include newly added workflows.

## Execution ledger

Each task requires an exact SHA, PR, relevant Actions run IDs, pass/fail evidence, and next action.

- [ ] **M26-00:** Inventory all jobs, runner labels, dependency versions, and production controls.
- [ ] **M26-01:** Assess Ubuntu 26 breaking changes and assign failure risks.
- [ ] **M26-02:** Introduce an isolated, manual, unprivileged Ubuntu 26 canary.
- [ ] **M26-03 (IN_PROGRESS):** Track the latest secure Node 24 patch without hardcoding; preserve pnpm 10.34.5. Draft PR #720 fixes the dependency-validator runtime-major contract; exact-head CI is pending.
- [ ] **M26-04:** Validate frozen installs, client/SSR builds, tests, and native packages.
- [ ] **M26-05:** Validate Playwright Chromium installation, functional E2E, and safe smoke tests.
- [ ] **M26-06:** Validate Docker seccomp, offline sandbox, CodeQL, and audit preflight.
- [ ] **M26-07:** Move unprivileged CI, dependency, maintenance, and security jobs.
- [ ] **M26-08:** Move read-only production verification jobs and exact-SHA gates.
- [ ] **M26-09:** Move protected Worker, D1, image Worker, and Apps Script operations safely.
- [ ] **M26-10:** Verify all cross-workstream checks, Renovate, Vercel, and deployment gates.
- [ ] **M26-11:** Validate documented temporary runner-label rollback and incident response.
- [ ] **M26-12:** Audit every job on main and close the issue only with verified evidence.

All tasks are P0 and PENDING at this planning checkpoint.

## Staged PR sequence

- **PR-00:** Tracker documentation only; PR #718.
- **PR-01:** Manual, read-only Ubuntu 26 compatibility canary.
- **PR-02:** Independent Node.js 24 patch update.
- **PR-03:** Core CI and unprivileged workflow migration.
- **PR-04:** Read-only production verification migration.
- **PR-05:** Protected workflow definitions after safe preflight evidence.
- **PR-06:** Final coverage audit, runbooks, and tracker closure.

## Safety and acceptance criteria

- Never weaken `quality`, CodeQL, branch protection, security checks, or production approvals.
- Canary must not contain production secrets, write D1, or deploy any live service.
- Preserve Docker network isolation, seccomp checks, and fail-closed behavior.
- Preserve protected release/rollback gates and read-only verification.
- Separate the Node patch change from the Ubuntu 26 baseline comparison.
- Confirm client and SSR builds, Chromium, Wrangler, and security sandbox behavior.
- Stop on unexpected deployment, skipped required check, or loss of rollback capability.
- Merge only on verified exact-commit CI results; revalidate current main each time.
- Roll back an affected job to `ubuntu-24.04` only while that image remains supported.
- Do not perform production rollback or data recovery as a migration test.

## Evidence checkpoints

- 2026-10-25: Main baseline `6ff0694`; Vercel READY and pnpm `10.34.5` confirmed.
- 2026-10-25: [Issue #717](https://github.com/yiwssx/new-www.rcat.ac.th/issues/717) created.
- 2026-10-25: Draft [PR #718](https://github.com/yiwssx/new-www.rcat.ac.th/pull/718) created.
- 2026-10-25: Initial PR CI failed Markdown formatting only; functional jobs passed.
- 2026-10-26: PR #718 documentation CI #40194792143 passed. M26-02 Ubuntu canary PR #719 passed browser and Docker isolation lanes, but its first Node/build lane failed the strict workflow inventory count; fix independently before merge.
- 2026-10-26: M26-03 Node policy PR #720 head `42fa19fbd26806a0db694e6bac3d4d68c858348e` resolves an exact-patch dependency validator mismatch. [CI #40231208358](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40231208358) was running when checked. Node major is `24`, pnpm remains `10.34.5`; no merge or production mutation.
- Next: require PR #720 exact-head `quality` and CodeQL checks before merging; separately reconcile Ubuntu 26 canary workflow inventory.

## Official references

- [GitHub Ubuntu 26 migration](https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration/)
- [GitHub runner-images migration](https://github.com/actions/runner-images/issues/14748)
- [Node.js security releases](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
- [Vercel Node.js support](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
