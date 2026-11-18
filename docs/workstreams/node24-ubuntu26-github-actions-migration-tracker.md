# Ubuntu 26.04 / Node 24 GitHub Actions migration — CLOSED acceptance record

**Owner acceptance date:** 2026-11-18 (Asia/Bangkok)  
**Scope:** `yiwssx/new-www.rcat.ac.th` GitHub-hosted CI compatibility; **not** Ubuntu installation or upgrades on production servers.  
**Master issue:** [#717](https://github.com/yiwssx/new-www.rcat.ac.th/issues/717) — owner-authorized closure as `completed`.  
**Source baseline:** `main@74e56741075a60eec2945fe0fd71358c8c7bbb17` (2026-11-02; prior to this docs-only closure).  
**Interpretation:** Checked means the work item has **reached its accepted disposition**, not that every possible workflow or privileged production path was executed.

## Final acceptance — all work items resolved

- [x] **M26-00 — Inventory accepted.** At source baseline, 14 workflow YAMLs with 44 jobs: 41 jobs using floating `ubuntu-latest`, three isolated canary jobs explicitly `ubuntu-26.04`. Older 12-workflow / 36+3 counts are superseded.
- [x] **M26-01 — Risk assessment disposition accepted.** The runner image is CI infrastructure, separate from Vercel and Cloudflare production runtimes. Remaining theoretical 24-to-26 OS differences are not blockers without a related failing path. The owner has confirmed real Docker problems **in other projects**; do not falsely label Docker universally safe, and do not conflate separate systems with this repo's proven sandbox path.
- [x] **M26-02 — Canary accepted.** Existing unprivileged three-job Ubuntu26 canary passed; no rerun: [run #40282859796](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40282859796).
- [x] **M26-03 — Toolchain accepted.** Node 24 major policy and pnpm 10 core merged in [PR #720](https://github.com/yiwssx/new-www.rcat.ac.th/pull/720) and [PR #729](https://github.com/yiwssx/new-www.rcat.ac.th/pull/729); repository `packageManager=pnpm@10.34.5`.
- [x] **M26-04 — Native build accepted.** Ubuntu26 canary validated frozen-lockfile install, typechecks, client/SSR builds, unit/integration, Worker dry-run and native dependency tooling.
- [x] **M26-05 — Chromium compatibility accepted.** On Ubuntu26 canary Playwright installed and 149 functional tests passed. The *production browser smoke* on an actual floating Ubuntu26 runner is **not claimed as executed**; it is not a separate mandatory OS-migration acceptance gate.
- [x] **M26-06 — Security path accepted.** Ubuntu26 Docker/seccomp and offline quick/standard sandbox control checks succeeded. This is **not** a claim of a complete independent security audit, or a claim that Docker is problem-free in other repositories.
- [x] **M26-07 — Floating-runner policy accepted.** Keep 41 ordinary jobs floating on GitHub-managed `ubuntu-latest`; maintain three explicitly labeled Ubuntu26 canaries. Do not mass-pin normal jobs.
- [x] **M26-08 — Production-verification OS disposition accepted.** Live read-only WAF smoke ran successfully on a real Ubuntu26 floating runner: [run #44262786875, job #134659934502](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/44262786875/job/134659934502). Other conditionally skipped browser/CSP/privileged paths remain **not executed**, with existing normal CI/production guardrails retained.
- [x] **M26-09 — Protected-workflow scope resolved without unsafe tests.** Existing Worker/D1/Apps Script protected environment and release controls retained. Live production Worker/image Worker deploy, Apps Script release, D1 write, retention delete or rollback is **not required** solely to certify a GitHub-hosted OS image. No untested protected operation is represented as PASS.
- [x] **M26-10 — Governance evidence accepted.** [Current-main CI #41465640735](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/41465640735) passed all eleven jobs including required `quality` (its Build ran **Ubuntu24**); existing CodeQL and previous security/release evidence were accepted, plus separate Ubuntu26 canary and observed normal floating jobs. This is *combined* evidence, not a claim that every CI lane passed again on Ubuntu26.
- [x] **M26-11 — Rollback plan accepted.** Owner already accepted documented emergency fallback to the explicitly supported `ubuntu-24.04` runner (only while available). No production rollback or unsafe exercise was requested or performed.
- [x] **M26-12 — Closure criteria fulfilled under revised scope.** Real GitHub floating label `ubuntu-latest` emitted `Image: ubuntu-26.04` on [Maintenance cache job #134744220435](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/44287612179/job/134744220435) PASS and [WAF job #134659934502](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/44262786875/job/134659934502) PASS; the owner accepted canary, real runner observation and risk boundaries as sufficient for closure. There is no 41-of-41 execution requirement.

## Explicitly separate concerns (not #717 blockers)

**Dependency Monitor:** [run #44257833332](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/44257833332), on a genuine Ubuntu26 floating runner, FAILED on dependency compatibility policy (outdated packages and an `@types/node` policy exception). Node/pnpm setup succeeded first; therefore do not attribute this failure to a broken Ubuntu runner. Handle package-policy maintenance under its own ordinary backlog.

**PR #731:** [Protected pnpm cleanup](https://github.com/yiwssx/new-www.rcat.ac.th/pull/731) remains intentionally DRAFT / UNMERGED / ON HOLD. Its production Image Worker deployment and non-dry-run Actions/deployment-history retention deletion effects require separate explicit authorizations. No merge, production action, deletion or permission relaxation is authorized by #717 closure.

**Docker on other projects:** The owner reports actual Docker issues in other repositories; treat them as their own incidents with host/image-specific evidence. Successful Docker security sandbox on this repository is evidence only for this repository and this tested path.

## Evidence preservation and operational boundaries

- Historical tracker snapshots, unfinished older draft checkboxes, superseded criteria and original risk assumptions are retained in **Git commit history** and the [issue conversation](https://github.com/yiwssx/new-www.rcat.ac.th/issues/717); this canonical file now records the final disposition rather than keeping obsolete tasks open.
- Any later actual failure correlated to `ubuntu-latest` should be diagnosed as a **new concrete incident** with a job log and runner image reference. Do not reopen this resolved migration checklist without new causal evidence.
- No production deployment, GitHub Actions dispatch, rollback, retention deletion, protected authorization or security-gate bypass is needed for acceptance.
