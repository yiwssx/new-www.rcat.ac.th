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
- PR #719 repair head `8aeb1e234c4f79f8de10451ddd3dcce42e1b932e` passed all 16 checks, including all three Ubuntu 26 canary lanes.
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
- [ ] **M26-02 (IN_PROGRESS; PR VERIFIED):** PR #719 head `8aeb1e234c4f79f8de10451ddd3dcce42e1b932e` passed all 16 checks, including quality, CodeQL and all three canary lanes. Branch validation is complete; merge and main verification remain pending.
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
- This waiting checkpoint is superseded by the verified results below.

## Verified canary checkpoint — 2026-10-26

- Owner: `yiwssx`; PR #719 repair head: `8aeb1e234c4f79f8de10451ddd3dcce42e1b932e`. All **16/16 checks SUCCESS**; no rerun or duplicate dispatch needed.
- [CI #40232576286](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40232576286): all lanes and aggregate `quality` SUCCESS.
- [CodeQL #40232573819](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40232573819): Actions and JavaScript/TypeScript analyses SUCCESS. CodeQL result [121287376691](https://github.com/yiwssx/new-www.rcat.ac.th/runs/121287376691) is now SUCCESS with no new alerts; earlier NEUTRAL state was interim.
- [Ubuntu 26 canary #40232576275](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40232576275): runtime, browser and offline security all SUCCESS. Required functional steps were individually verified; none were skipped.
- [Runtime/build job](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40232576275/job/121287245751): `ID=ubuntu VERSION_ID=26.04`, `ImageOS=ubuntu26`, environment `ImageVersion=20261023.163.3`; Node `v24.20.0`, pnpm `10.34.5`. Frozen strict-peer install, dependency checks, formatting, lint, 2,752 unit tests, 20 integration tests, client/SSR builds, Worker typecheck and deploy dry-run passed.
- [Browser job](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40232576275/job/121287245801): Chromium installation with system dependencies and production test discovery passed without production access; **149 local functional tests passed**.
- [Security job](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40232576275/job/121287245563): Docker built-in seccomp confirmed; pinned image, disposable offline sandbox and quick/standard preflight all passed.
- OS comparison: [main build job](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40191986494/job/121164812362) used `ubuntu-24.04` image `20261012.334.1` with the same Node `v24.20.0`, pnpm `10.34.5` and frozen strict-peer install. This preserves the OS-only comparison before PR #720 changes Node selection. Runner setup headers and environment image metadata are recorded as emitted, not assumed identical across jobs.
- PR #720 remains draft/unmerged at `42fa19fbd26806a0db694e6bac3d4d68c858348e`, all 13 checks still SUCCESS. No repeated Node repair.
- PR #718 head before this update: `fc30c5130d0cb391318ac3e936180b627c6951ed`; [CI #40232650718](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40232650718) had Functional E2E pending when first checked; CodeQL and other completed lanes passed. This documentation update requires checks on its new exact head.
- Main remains `6ff069420b56977b1b189f7a54aa8dbdc701f25b`. All three PRs remain unmerged; production runtime/settings, protected workflows and security gates unchanged.
- Next: verify fresh PR #718 documentation checks, review merge/deployment boundaries, then integrate tracker and canary through normal gates and validate main. Report this verified checkpoint before starting pnpm centralization or migrating additional runner labels. M26-00/01 and main/production acceptance remain open; this is not full migration completion.

## pnpm follow-up decision

PENDING; no implementation yet. Keep `packageManager` exact for Corepack/Vercel, allow `engines.pnpm=10.x`, remove duplicate action version inputs in a separate PR, and permit constrained Renovate packageManager updates below 11 with CI/preview evidence. Never replace Corepack metadata with `pnpm@10.x`. This follows PR #720 and remains separate from the Ubuntu baseline.

## Official references

- [GitHub Ubuntu 26 migration](https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration/)
- [GitHub runner-images migration](https://github.com/actions/runner-images/issues/14748)
- [Node.js security releases](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
- [Vercel Node.js support](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

## Continuous execution checkpoint — core runner migration

The user authorized continuous execution across CI waits on 2026-10-26. Production mutations still require separate approval.
PR #718 is merged at `cd2fd5777f7facd519c7b9230a7bf63195291cbe`; its main CI #40234230710 and CodeQL #40234230868 passed.
PR #719 was refreshed with that main baseline at `18db14f8adbecf218f2ffb1ad3ba132c2a670d98`; initial OS evidence remains separately recorded above.

### Inventory and risks (M26-00 / M26-01)

Owner: `yiwssx`. Inventory: 12 repository workflow files, 39 jobs; 36 originally floating Ubuntu jobs plus 3 explicit Ubuntu 26 canary jobs. CodeQL default setup is provider-managed and was independently checked; it is not a missing repository YAML file.

| Workflow                       | Jobs | Production boundary                                                        |
| ------------------------------ | ---: | -------------------------------------------------------------------------- |
| CI                             |   10 | Build/test/dry-run only                                                    |
| Dependency Monitor             |    2 | GitHub maintenance; no application deployment                              |
| Maintenance & Recovery         |    3 | Two GitHub cleanup jobs; D1 drill stays protected                          |
| Security Audit Preflight       |    1 | Manual offline sandbox                                                     |
| Production Verification        |    6 | Read-only checks; protected manual D1 diagnostics                          |
| Production Data Operations     |    6 | One tooling validation; five protected operations                          |
| Worker release / rollback      |    3 | Manual protected preflight, release and rollback                           |
| Apps Script release / rollback |    3 | Manual protected preflight, release and rollback                           |
| Image Worker                   |    2 | **Push to its workflow file automatically deploys production; hold merge** |
| Ubuntu 26 canary               |    3 | Unprivileged, no production credentials                                    |

| Risk                                           | Validation / disposition                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Native esbuild/sharp/workerd and glibc/OpenSSL | Frozen strict-peer install, client/SSR/Worker dry-run passed in Ubuntu 26 canary; main core CI must independently pass                                 |
| Chromium apt dependencies                      | `playwright install --with-deps chromium` and 149 local browser tests passed                                                                           |
| Docker/seccomp/isolation                       | Pinned image and offline sandbox quick/standard profiles passed; keep all flags/limits unchanged                                                       |
| Git/shell/Actions changes                      | Real canary checkout/setup/test jobs passed; preserve all permissions/triggers/concurrency                                                             |
| Node version policy                            | #720 is separate; merging `.node-version` triggers Vercel because unknown root paths are conservatively runtime-impacting                              |
| pnpm/Corepack                                  | Preserve exact packageManager metadata; centralization and constrained Renovate follow separately                                                      |
| Protected operations                           | Runner definitions can be reviewed without executing a production release, rollback or data write; protected preflight is distinct acceptance evidence |

### Core implementation (M26-07)

Change only `runs-on` for 15 jobs: all 10 CI jobs, both dependency jobs, both unprotected maintenance jobs, and offline security preflight. Leave the protected D1 drill and all other production-adjacent runner definitions for separate scopes.
Python YAML structural comparison against the branch baseline confirms every non-runner field is identical, including check names, quality dependencies, triggers, permissions, secret boundaries and approvals.
Node #720 remains unmerged pending production authorization. This core lane deliberately retains the already-validated OS-only Node baseline, rather than allowing that approval boundary to block safe non-runtime implementation.

### Rollback (M26-11 preparation)

If Ubuntu 26 breaks a gate, stop downstream merges. Revert only affected runner labels to explicit `ubuntu-24.04` through a reviewed PR while that image is supported; require exact-head quality/CodeQL again. Do not fall back to floating `ubuntu-latest`.
This runner rollback does not roll back Vercel, Worker, Apps Script or production data. Never dispatch deployment/data recovery as a compatibility test.
Final protected preflight, all-job coverage and main CI evidence remain mandatory before M26-12 closure.

## Operations runner definitions (M26-08 / M26-09)

Scope: 19 further jobs in Production Verification, Production Data Operations, protected D1 recovery drill, Worker release/rollback and Apps Script release/rollback. Change only runner labels to `ubuntu-26.04`.
All `on`, `if`, `permissions`, `environment`, credentials, confirmation inputs, exact-SHA checks, concurrency, release and rollback commands remain structurally identical to the preceding core-runner baseline.
These workflow edits do not dispatch protected preflight, release, rollback, D1 writes or Apps Script operations. Production Verification already owns automatic read-only checks; preserve its exact-SHA/non-runtime classification.

After integrating core plus this scope, 37/39 repository jobs use Ubuntu 26. The two remaining Image Worker jobs are deliberately isolated in their own approval-held PR because changing that workflow on main automatically deploys production.
Acceptance remains IN_PROGRESS: ordinary CI and CodeQL must pass on each exact PR head and on main; protected Worker/Apps Script/D1 preflight must be separately run through the existing protected main-only operation with read-only credentials. Static validation is not a claimed live preflight PASS.

## Image runner approval hold

The final two job labels in `image-production-worker.yml` are prepared separately. All 39 repository Ubuntu jobs then use explicit Ubuntu 26.04. No trigger, permission, deploy command or secret reference changes.
**Do not merge this scope without production authorization:** its existing push path includes the workflow itself and its deploy job has no protected Environment. Merging its label change therefore automatically deploys the existing Image Worker source. PR validation runs only lint, typecheck and Wrangler dry-run; it does not authorize a production deployment.
This hold is a discovered existing trigger boundary, not a proposed security-gate bypass. Do not silently remove the push trigger or add a bypass to finish migration.
