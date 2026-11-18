# Ubuntu 26.04 CI runner migration: final acceptance

Status: **Completed by owner acceptance on 2026-11-18**.

Repository: `yiwssx/new-www.rcat.ac.th`. Master issue: [#717](https://github.com/yiwssx/new-www.rcat.ac.th/issues/717).

This migration concerns GitHub-hosted CI runners, not Vercel, Cloudflare or production server OS upgrades.

A checked item means its **disposition has been accepted**, not that every possible production workflow was executed.

## Final checklist

- [x] M26-00: Reviewed 14 workflow YAML files and 44 jobs at main `74e56741075a`.
- [x] M26-01: Accepted risk evaluation based on actual repo behavior and observed failures.
- [x] M26-02: Accepted three successful Ubuntu 26.04 canary jobs; no retest required.
- [x] M26-03: Accepted merged Node 24 and pnpm 10 changes in PR #720 and PR #729.
- [x] M26-04: Accepted frozen install, client/SSR build, unit/integration tests and Worker dry-run.
- [x] M26-05: Accepted Chromium installation and 149 passing functional tests on Ubuntu 26.04.
- [x] M26-06: Accepted offline Docker/seccomp sandbox tests within the tested scope.
- [x] M26-07: Retained 41 ordinary jobs on `ubuntu-latest` and 3 explicit Ubuntu 26.04 canary jobs.
- [x] M26-08: Accepted passing read-only WAF smoke on a real floating Ubuntu 26.04 runner.
- [x] M26-09: Accepted the decision not to run privileged Production workflows as OS tests.
- [x] M26-10: Accepted existing main CI/CodeQL evidence combined with Ubuntu 26.04 canary results.
- [x] M26-11: Accepted emergency Ubuntu 24.04 runner fallback documentation without live rollback.
- [x] M26-12: Confirmed actual `ubuntu-latest` jobs ran on Ubuntu 26.04; accepted scoped closure.

## Verification records

- [Ubuntu 26.04 canary, all three jobs passed](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40282859796).
- [Current baseline main CI and required quality passed](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/41465640735).
- [Actual Ubuntu 26.04 WAF smoke passed](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/44262786875).
- [Actual Ubuntu 26.04 maintenance job passed](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/44287612179).

The historical main CI above ran on Ubuntu 24.04. Do not present it as an Ubuntu 26.04 test.

## Deliberate scope boundaries

Protected Worker, Image Worker, D1 and Apps Script deployment/rollback paths were not all tested on Ubuntu 26.04.
These were excluded from the final OS-only acceptance requirement; skipped jobs are not counted as passing.

[Dependency Monitor #44257833332](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/44257833332)
failed a dependency compatibility policy after successful setup on Ubuntu 26.04.
This is not evidence that the Ubuntu runner failed and is not silently reported as passing.

[PR #731](https://github.com/yiwssx/new-www.rcat.ac.th/pull/731) remains Draft and unmerged.
Its Image Worker deployment and potentially destructive Actions history cleanup require separate approval.

The owner reports real Docker issues in other repositories. This repository's passing sandbox test does not
disprove those issues. Handle them as distinct, evidence-based incidents outside #717.

No production deployments, protected operation dispatches, retention deletions, permission changes
or security gate bypasses are authorized by this closure.

Historical plans and unchecked milestones are retained in Git history and the issue discussion.
This file replaces the obsolete live checklist with the final accepted disposition.
