# Node.js 24 LTS and Ubuntu 26.04 migration

**Status:** ACTIVE (planning and evidence gathering)
**Priority:** P0 (shared CI/CD infrastructure)
**Updated:** 2026-10-26 (Asia/Bangkok)
**Issue:** [#717](https://github.com/yiwssx/new-www.rcat.ac.th/issues/717)
**Planning PR:** [#718](https://github.com/yiwssx/new-www.rcat.ac.th/pull/718)
**Baseline main:** `6ff069420b56977b1b189f7a54aa8dbdc701f25b`

## Objective

Move every active GitHub-hosted Ubuntu Actions job to explicit `ubuntu-26.04`.
Track the latest secure Node.js 24 release without hardcoding minor/patch in `.node-version` (PR #720).
Keep Vercel Node `24.x` and pnpm major 10. pnpm remains exact `10.34.5` until the separate centralization task.
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
- PR #719 has partial Ubuntu 26 evidence; its initial runtime lane failed the workflow inventory contract.
- The baseline above describes main; branch-only validation does not prove a production rollout.

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
- [ ] **M26-02 (IN_PROGRESS):** PR #719 adds the unprivileged canary. Inventory and toolchain checks repaired at `8aeb1e234c4f79f8de10451ddd3dcce42e1b932e`; exact-head CI, CodeQL and all three canary lanes required before merge.
- [ ] **M26-03 (IN_PROGRESS):** Track the latest secure Node 24 patch without hardcoding; preserve pnpm 10.34.5. PR #720 head `42fa19fbd26806a0db694e6bac3d4d68c858348e` passed all 13 CI/CodeQL checks; draft and unmerged. No repeated implementation needed.
- [ ] **M26-04:** Validate frozen installs, client/SSR builds, tests, and native packages.
- [ ] **M26-05:** Validate Playwright Chromium installation, functional E2E, and safe smoke tests.
- [ ] **M26-06:** Validate Docker seccomp, offline sandbox, CodeQL, and audit preflight.
- [ ] **M26-07:** Move unprivileged CI, dependency, maintenance, and security jobs.
- [ ] **M26-08:** Move read-only production verification jobs and exact-SHA gates.
- [ ] **M26-09:** Move protected Worker, D1, image Worker, and Apps Script operations safely.
- [ ] **M26-10:** Verify all cross-workstream checks, Renovate, Vercel, and deployment gates.
- [ ] **M26-11:** Validate documented temporary runner-label rollback and incident response.
- [ ] **M26-12:** Audit every job on main and close the issue only with verified evidence.

All tasks are P0. Owner: `yiwssx` (implementation assistance: Codex).
M26-02 and M26-03 are IN_PROGRESS; remaining tasks are PENDING until their full acceptance evidence exists.
No task is DONE merely because a branch passes checks.

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
- 2026-10-26 reconciliation: main remains `6ff069420b56977b1b189f7a54aa8dbdc701f25b`; [main CI #40191986494](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40191986494) and [CodeQL #40191986184](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40191986184) passed. All three PRs are draft, open and unmerged.
- PR #718 head `e6c0f35d5dd1b93959e537c359259938e642b6cb`: all 13 checks passed, including [CI #40231336312](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40231336312) and [CodeQL #40231333673](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40231333673). This checkpoint update creates a new docs head requiring fresh validation.
- PR #720 head `42fa19fbd26806a0db694e6bac3d4d68c858348e`: all 13 checks passed, including [CI #40231208358](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40231208358) and [CodeQL #40231204669](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40231204669). Do not repeat its fixed validator work.
- PR #719 initial head `a906a488f0b4cd0cc5be8f36ea6382207ea5774c`: both failing jobs stopped at `workflowInventoryGovernance.test.ts` because the explicit list omitted the new canary (12 actual / 11 expected). Browser and offline sandbox passed; client/SSR/Worker dry-run steps after the failed unit gate were skipped and are not PASS evidence.
- PR #719 repair head `8aeb1e234c4f79f8de10451ddd3dcce42e1b932e`: explicitly register the twelfth workflow without relaxing the inventory assertion; add production-isolation regression assertions; accept major-only Node marker while still enforcing the exact baseline pin when present. No Node/pnpm/production runner configuration change.
- Local verification: repository lockfile Prettier `3.9.10` formatted both changed files; focused Vitest `5.0.5` passed 4 tests against the branch's 12 workflows; shell toolchain matrix passed 7/7 (exact pin, major marker, wrong patch/major, prerelease, pnpm mismatch, shell data).
- New exact-head [CI #40232576286](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40232576286) and [Ubuntu 26 canary #40232576275](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40232576275) are IN_PROGRESS at checkpoint. CodeQL must also be confirmed at this repair SHA before any merge.
- Safety: no merge to main, production deployment, protected operation, secrets change or security-gate bypass. ASVS 1.2.5 comparison avoids evaluating version data; ASVS 15.2.5 production-isolation assertions preserve the canary boundary.
- Next: verify these existing runs and CodeQL on the exact PR #719 repair SHA; fix any failure, then report before the next migration step. Do not start pnpm centralization or runner migrations while this checkpoint is pending.

## pnpm follow-up decision

PENDING; no implementation yet. Keep `packageManager` exact for Corepack/Vercel, allow `engines.pnpm=10.x`, remove duplicate action version inputs in a separate PR, and permit constrained Renovate packageManager updates below 11 with CI/preview evidence. Never replace Corepack metadata with `pnpm@10.x`. This follows PR #720 and remains separate from the Ubuntu baseline.

## Official references

- [GitHub Ubuntu 26 migration](https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration/)
- [GitHub runner-images migration](https://github.com/actions/runner-images/issues/14748)
- [Node.js security releases](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
- [Vercel Node.js support](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
