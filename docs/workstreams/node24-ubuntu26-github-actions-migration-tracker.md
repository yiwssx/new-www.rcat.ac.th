# Node.js 24 LTS + Ubuntu 26.04 GitHub Actions Migration Tracker

**Status:** ACTIVE — PLANNING ONLY  
**Priority:** P0 — critical cross-cutting CI/CD infrastructure  
**Updated:** 2026-10-25 (Asia/Bangkok)  
**Repository:** `yiwssx/new-www.rcat.ac.th`  
**Default branch:** `main`  
**Read-only baseline SHA:** `6ff069420b56977b1b189f7a54aa8dbdc701f25b` (recheck before each implementation PR)  
**GitHub issue:** [#717](https://github.com/yiwssx/new-www.rcat.ac.th/issues/717)  
**Tracker branch:** `docs/node24-ubuntu26-migration-tracker`  
**Tracker draft PR:** [#718](https://github.com/yiwssx/new-www.rcat.ac.th/pull/718) (docs only; pending required checks)  
**Migration execution:** NOT STARTED; no runner, application, production service, Node, pnpm, or CI configuration changes have been authorized by this planning-only PR

## Decision and objective

Migrate every *active* GitHub-hosted Ubuntu runner job off the floating `ubuntu-latest` label to explicit `ubuntu-26.04`; advance the CI Node.js 24 LTS patch to a currently secure release, initially `24.22.1`; retain Vercel Node `24.x` and repository-wide `pnpm 10.34.5`. Preserve the behavior of all feature and maintenance PRs, merge gates, production deployments, read-only verification, privileged operations, security safeguards, and rollback paths.

This is a **platform migration**, not a dependency-major upgrade, architectural refactor, or production release.

GitHub's **`ubuntu-latest` migration** is staged between **2026-10-19 and 2026-11-19**. **There is no announced 2026-11-19 retirement of the explicit `ubuntu-24.04` image.** Ubuntu 24.04 may be used only as an explicitly supported temporary rollback. Do not rely on a floating label for rollback.

## Verified repository/Vercel baseline

- `.node-version`: `24.20.0`; `package.json` engines Node: `24.x`; `packageManager` and engines pnpm: `10.34.5`.
- Central composite setup: `.github/actions/setup-project/action.yml` uses `pnpm/action-setup@v6` and `actions/setup-node@v7`, with `--frozen-lockfile --strict-peer-dependencies`.
- Vercel project `new-www.rcat.ac.th` is configured for Node `24.x`. The 2026-10-25 production READY deployment `dpl_Bx5GSyAKTf21KxiUcgQr73Q5qF3a` logged `ENABLE_EXPERIMENTAL_COREPACK=1`, detection of `pnpm@10.34.5`, and successful dependency installation using pnpm `10.34.5`.
- `package.json` build is `tsc --noEmit -p tsconfig.json && vite build`; `vercel.json` additionally runs Vite SSR and `scripts/prepare-ssr-cutover-output.mjs`. Test **both** client and SSR build contracts.
- `ci.yml` has ten Ubuntu jobs, including the aggregate required check `quality`. Its Governance job executes the pinned Docker Security Audit sandbox and read-only preflight; Functional E2E installs Playwright Chromium using `--with-deps`.
- `security-audit-preflight.yml` is a recently added, explicit manual workflow that runs the same bounded offline Docker sandbox; it must be included.
- `renovate.json` governs npm/GitHub Actions updates; existing Renovate PRs may advance while this workstream is active. Recheck exact commit, approved toolchain and lockfile on every PR.
- Do not infer successful Ubuntu 26 execution from a successful Ubuntu 24 build or from Vercel Production readiness.

## Active workflow scope — 11 files, all jobs within each file

1. `.github/workflows/ci.yml` — dependency preflight, dependency audit, quality, unit/integration, build, Governance Docker audit, Worker dry run, functional Playwright E2E.
2. `.github/workflows/dependency-status-sync.yml` — scheduled dependency monitor and authorized snapshot-repair path.
3. `.github/workflows/maintenance-recovery.yml` — deployment/Actions cleanup, cache maintenance, protected read-only D1 recovery readiness.
4. `.github/workflows/security-audit-preflight.yml` — manual offline security preflight and Docker containment.
5. `.github/workflows/production-verification.yml` — trusted post-CI read-only production browser QA, WAF, CSP, reliability, protected diagnostic/observability.
6. `.github/workflows/production-data-operations.yml` — Facebook tooling, protected D1/CMS operations, intentional disposable field tests and cleanup.
7. `.github/workflows/image-production-worker.yml` — automatic image Worker validation and gated production deploy.
8. `.github/workflows/worker-production.yml` — protected Cloudflare Worker/D1 production preflight and release.
9. `.github/workflows/worker-production-rollback.yml` — protected Worker runtime rollback.
10. `.github/workflows/apps-script-production-release.yml` — protected Apps Script preflight and release.
11. `.github/workflows/apps-script-production-rollback.yml` — protected Apps Script rollback.

**Coverage rule:** Count **jobs**, not only workflow files. Search all active `.github/workflows/*.{yml,yaml}` on the latest main and every new PR for `runs-on`, including newly introduced jobs; exclude historical code snippets such as `ops/o10-procurement-import-source.txt`. Discover self-hosted or containerized jobs separately, and do not blindly rewrite their labels.

## Work ledger

Status vocabulary: `PENDING` (not started), `IN_PROGRESS` (evidence incomplete), `BLOCKED` (cannot safely proceed), `DONE` (verified at exact SHA). Owner: **repo operator / execution assignee not yet recorded**. All phases are P0; split implementation tasks into small PRs.

- [ ] **M26-00 — Inventory and evidence baseline — PENDING.** Revalidate current main SHA, each job's runner label, protected vs unprivileged trigger, relevant ongoing PRs, Vercel node/pnpm build log, latest secure Node 24 patch, exact `quality` ruleset. Record image provenance via `ImageOS`, `ImageVersion`, Node and pnpm versions. **Gate:** complete inventory and immutable reference evidence.
- [ ] **M26-01 — Breaking-change/threat-model analysis — PENDING.** Review official Ubuntu 24→26 installed-tool differences; Docker daemon/seccomp, `bash`, `git`, `apt`, OpenSSL/glibc, `sharp`, `esbuild`, `workerd`, Wrangler, GitHub Actions requirements and Playwright Chromium host dependencies. **Gate:** documented severity, root-cause checks and remediation ownership.
- [ ] **M26-02 — Isolated Ubuntu 26 canary — PENDING.** Propose a **manual**, read-only GitHub Actions compatibility lane using `ubuntu-26.04`, no production secrets/Environment, no live deployment and no D1 write. Capture sanitized environment and exit-code evidence. Do not make it required or duplicate scheduled monitoring during diagnostics. **Gate:** canary is safe and observable.
- [ ] **M26-03 — Node.js 24 LTS security patch — PENDING.** Independently update `.node-version` from `24.20.0` to the most recent verified secure Node 24 patch (initial candidate `24.22.1` from 2026-10-21). Keep `package.json` Node engine `24.x` and pnpm `10.34.5`; keep `pnpm-lock.yaml` unchanged unless strictly justified. **Gate:** Node 24 patch tests pass on a controlled runner and the Vercel Node 24 boundary remains intact.
- [ ] **M26-04 — Dependency, build and test compatibility — PENDING.** On explicit Ubuntu 26: immutable install; `deps:check`, `format:check`, `lint:strict`, unit/integration, Worker typecheck/dry run, Vite client/SSR build, native tool install and build checks. **Gate:** exact-head test evidence; no accepted bypasses.
- [ ] **M26-05 — Browser compatibility — PENDING.** Playwright Chromium `install --with-deps`, functional tests, production test discovery and existing read-only field QA after normal trusted gates. Check browser binaries and installed OS libraries. **Gate:** E2E and field QA evidence without changing content.
- [ ] **M26-06 — Docker/CodeQL security boundary — PENDING.** On Ubuntu 26 verify pinned `node:24-bookworm-slim` audit sandbox, host Docker seccomp, no-network/read-only container, non-root execution, caps/memory/timeouts; run quick/standard security preflight, preserve CodeQL and secret safety. **Gate:** sandbox fails closed on invalid policy and passes on expected policy.
- [ ] **M26-07 — Unprivileged migration PR(s) — PENDING.** Move `ci.yml`, dependency monitor, maintenance non-privileged jobs, security preflight to **explicit** `ubuntu-26.04` in small reviewable batches. Do not rename `quality`, relax `always()`, weaken permissions or change concurrency. **Gate:** exact PR SHA and post-merge main checks pass.
- [ ] **M26-08 — Read-only production verification migration — PENDING.** Move Production Verification jobs and check Vercel exact-SHA sequencing, skipped builds, browser smoke, CSP, WAF, reliability and branch trust logic; retain manual protected operation boundaries. **Gate:** no false green, duplicate CI, or production write.
- [ ] **M26-09 — Protected operations migration — PENDING.** Scoped PR(s) for `image-production-worker.yml`, `worker-production*.yml`, `apps-script-production-*.yml`, protected `production-data-operations.yml` and D1 maintenance. Use *non-mutating* preflights and safe static validation before authorizing any real deployment. **Gate:** preserved protected Environment approvals and release/rollback safety, no live rollback tests.
- [ ] **M26-10 — End-to-end cross-workstream regression — PENDING.** Verify required `quality`, CodeQL, GitHub branch rules, Renovate compatibility, PR merging, Vercel READY + exact commit status and ignore-build semantics, Worker/D1 smoke, security/reliability scheduled jobs and manual job availability. **Gate:** all required checks pass on appropriate exact head/main; distinguish skipped from pass.
- [ ] **M26-11 — Rollback and operational readiness — PENDING.** Record how to revert runner label to explicitly supported `ubuntu-24.04`, isolate offending PR, regenerate tests, and avoid unrelated live Vercel/Worker/D1/Apps Script rollbacks; verify that the safety runbook works at configuration level. **Gate:** incident decision path and follow-up evidence recorded.
- [ ] **M26-12 — Closure — PENDING.** Audit every active job on main for intentional `ubuntu-26.04`; verify Node 24 LTS target, pnpm v10, quality/CodeQL, required feature-PR gates, read-only production verification and protected preflight. Update issue #717 and close only with run IDs, exact SHAs, any accepted residual risk, and an owner-approved release checkpoint.

## Proposed implementation PR sequence and dependency graph

- **PR-00 — Tracker only (current PR):** Add this Markdown workstream tracker and issue linkage. No runtime or workflow edits.
- **PR-01 — Compatibility canary:** M26-00 through M26-02, manual/read-only; evaluate OS first without changing Node version.
- **PR-02 — Node 24 patch:** M26-03 after OS compatibility baseline; a **separate PR** so Node regression is attributable.
- **PR-03 — Core CI migration:** M26-04 through M26-07; keep required `quality` stable and enforce exact-head PR/main success.
- **PR-04 — Read-only runtime QA:** M26-05 and M26-08; prove production verification and security/reliability gates under Ubuntu 26.
- **PR-05 — Privileged workflow definitions:** M26-09 only after upstream checks; avoid live production mutations solely for migration verification.
- **PR-06 — Final inventory / closure:** M26-10 through M26-12; audit all active runner labels, update docs/runbooks, record evidence, and close the workstream.

Order can be adjusted to reduce production exposure but no task may be marked DONE before its defined acceptance. Each implementation PR must rebase/merge latest main and rerun required checks against its actual head SHA.

## Go / no-go and blast-radius controls

**GO only when:** immutable dependency install works; `quality`, CodeQL and existing mandatory checks pass; Playwright browser E2E passes; offline security sandbox proves isolation; Cloudflare Wrangler preflight/dry-run passes; no unreviewed production secrets, credentials, D1 writes, environment approval changes or deploys; production verification remains trusted, read-only and SHA-specific.

**STOP/NO-GO if:** Docker policy/permissions differ; native package compatibility breaks; browser system packages fail to install; critical unit/integration/SSR regressions occur; `quality` is skipped or fails; branch-protection/CodeQL changes hide failures; automation unexpectedly deploys; or rollback path becomes unavailable.

**Fallback:** while the label remains available, restore explicit `ubuntu-24.04` for *affected jobs only* as a temporary containment step and investigate with evidence. This does not change Vercel Node runtime, Cloudflare runtime, database contents, or deployed Apps Script versions. Do not rely on `ubuntu-latest` as a rollback target.

## Checkpoint / evidence ledger

- **2026-10-25 — BASELINE RECORDED:** 11 active workflow files using `ubuntu-latest`; baseline `main@6ff069420b56977b1b189f7a54aa8dbdc701f25b`; Vercel Production `dpl_Bx5GSyAKTf21KxiUcgQr73Q5qF3a` READY and logs show pnpm `10.34.5`; Node CI `24.20.0`, Vercel `24.x`.
- **2026-10-25 — ISSUE CREATED:** [#717](https://github.com/yiwssx/new-www.rcat.ac.th/issues/717); phases M26-00 through M26-12 all **PENDING**.
- **2026-10-25 — TRACKER PR:** Draft [#718](https://github.com/yiwssx/new-www.rcat.ac.th/pull/718) in `docs/node24-ubuntu26-migration-tracker`; original documentation commit `cae1b69be82b84a02e7643aea2150a3ca44a98df`, with initial CI run [#40193853094](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40193853094) queued when observed. **No Ubuntu 26 migration tests run** and **no production changes**. Recheck latest PR SHA and checks before merge.
- **Open blockers:** Ubuntu 26 compatibility and rollback evidence not yet collected; protected path validation pending; main branch may advance independently.
- **Next action:** Review/merge the documentation-only tracker PR after appropriate checks, then start M26-00 and M26-01 before a manual Ubuntu 26 compatibility canary.

For each subsequent checkpoint, record date, task IDs, status, branch/PR, exact SHA, GitHub Actions run URL(s), runner image/tool versions, evidence summary, blockers and next action. Do not paste secrets, diagnostic credentials or vulnerable details into public documents.

## Official references

- [GitHub — Ubuntu 26 GA and ubuntu-latest migration](https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration/)
- [GitHub runner-images — migration issue #14748](https://github.com/actions/runner-images/issues/14748)
- [Node.js — October 2026 security releases](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
- [Vercel — supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
