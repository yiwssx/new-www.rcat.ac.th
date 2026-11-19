<!-- prettier-ignore-start -->

# CI Protection Evidence and Safe Retry Runbook — 2026-10-28

Tracker: [#739](https://github.com/yiwssx/new-www.rcat.ac.th/issues/739). These are live GitHub API observations, not proof that post-merge CI can be reduced.

## Effective repository rulesets observed

- [Ruleset 20884227](https://github.com/yiwssx/new-www.rcat.ac.th/rules/20884227), `Protect master change gate`: **active**, targets `~DEFAULT_BRANCH` (currently `main`).
- Requires a pull request; requires resolution of review threads; `required_approving_review_count=0`.
- Required check `quality`, integration ID `15368`, with `strict_required_status_checks_policy=true`.
- `bypass_actors=[]` and `current_user_can_bypass=never` in the API response.
- [Ruleset 20884211](https://github.com/yiwssx/new-www.rcat.ac.th/rules/20884211), `Protect master integrity`: **active**, same default-branch target; prohibits deletion and non-fast-forward updates, with no declared bypass actors.
- The older branch-protection endpoint returned HTTP 403 to the integration: its classic branch-protection state **was not independently verified**. These results establish ruleset configuration, not proof from a deliberate blocked-push or stale-PR acceptance test.

**P4 current decision (2026-11-19):** Use verified change impact for documentation and allowlisted frontend/backend source on both PR and `push main`. [PR #790](https://github.com/yiwssx/new-www.rcat.ac.th/pull/790), [#792](https://github.com/yiwssx/new-www.rcat.ac.th/pull/792), and [#793](https://github.com/yiwssx/new-www.rcat.ac.th/pull/793) implement conservative lane selection; [#794](https://github.com/yiwssx/new-www.rcat.ac.th/pull/794) permits reuse of **previously successful Full PR E2E** only with independent exact-tree and CI-job provenance checks. Source/configuration/permissions/schema/unknown/destructive changes without a verified ownership rule **retain Full CI**. The owner accepted the existing ruleset evidence and did **not** require deliberately attempting a blocked push or stale merge. No deployment attestation or rollback requirement was removed. Do not substitute an unchecked PR head for the tested tree or an exact production release SHA.

## #782: Docs-only post-merge validation (implemented 2026-11-19)

- **Merged implementation:** [PR #790](https://github.com/yiwssx/new-www.rcat.ac.th/pull/790), commit `e01313908f90de0192e9ad68e9f02b8c81c038cc`. Its protected PR CI passed required `quality`, CodeQL, Unit, Integration, Build, Worker, Governance, Dependencies and Full E2E.
- **Scope:** A `push` to `refs/heads/main` changing only existing/new regular `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, or `docs/**/*.md[x]` can use Static Quality without unnecessary app suites. The required `quality`, Change Impact, Dependency Preflight and repository-wide Prettier remain active. ESLint is omitted for verified docs-only files.
- **Trust boundary:** The runner checks event `before`/`after` vs checkout SHA, exact main ref, ancestor relationship, bounded NUL-separated Git diff and regular non-symlink files. Deletions, renames, unsupported extensions, mixed changes, missing history and event inconsistencies fall back to Full CI.
- **Source and release safety:** Every source/config/auth/shared/Worker change still runs existing risk-based/full checks; **no source-impact Full E2E skipping** is enabled. Manual CI is always full. No Production release or ruleset bypass was added.
- **Operational acceptance:** Confirmed by the real docs-only main [CI run #44448578785](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/44448578785): Change Impact, Dependency Preflight, Static Quality, and `quality` passed; seven unrelated lanes skipped. This is completed evidence and does not need a repeat.

## #782: Scoped source impact and provenance-backed E2E reuse (2026-11-19)

- **Frontend-only:** Known Public/Admin frontend paths require their relevant lanes, including the existing **Full Functional E2E** for source impact, not unrelated Worker validation.
- **Backend-private:** Allowlisted internal Worker changes run backend Unit/Integration/Worker and appropriate security/governance checks without unrelated frontend Build/E2E.
- **Backend API or CRUD contract:** Consumers can be affected; include frontend Build/Full E2E and backend Worker checks. Mixed-path changes use the union of impacted lanes.
- **Unknown, auth/shared/schema, destructive rename/delete, or Git metadata ambiguity:** Fail closed to the existing Full CI path. Adding or modifying live CMS/D1 records outside Git is not a GitHub source push.
- **PR E2E:** Full browser tests remain mandatory on the relevant PR merge tree; ownership-based *partial Playwright spec selection for source changes* remains rejected. The historical shadow dual-run step was removed in #794, not the required Full E2E.
- **Main E2E reuse:** #794 checks a unique merged PR, exact base SHA/parent, identical Git tree, Git ancestry, completed successful Full PR Functional E2E + `quality` on the immutable PR head and before merge. The required main `quality` independently validates this proof. A reused lane is labelled **REUSED**, not newly executed; if any proof or API lookup fails, main runs normal E2E.
- **Observed boundary:** [PR #794](https://github.com/yiwssx/new-www.rcat.ac.th/pull/794) passed all protected PR checks; its actual [main CI run #44500302192](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/44500302192) also passed **Full**, appropriately because the change modified CI code. A subsequent, independently needed allowlisted frontend/backend source push is still required to observe a real main `REUSED` E2E status. Do not create dummy commits or extra testing solely for acceptance.
- **Production:** GitHub Branch Rulesets, required `quality`, CodeQL, Vercel/Cloudflare release/deployment verification and exact-SHA identity checks are separate controls and unchanged.

## Diagnosing a failed CI run

1. Open the failed `CI` workflow run and read the `Change Impact` summary, followed by the final `quality` summary. Check the planned-vs-observed table and listed gate errors.
2. Inspect the *first failing upstream lane*. A `quality` failure can be a consequence of another failed, cancelled, or unexpectedly skipped job.
3. For a transient runner/network failure with unchanged commit and unchanged required lanes, GitHub Actions **Re-run failed jobs** can preserve completed successful work. Re-evaluate the log afterwards.
4. For source, lockfile, workflow, base-branch, security, or integration changes, **fix and push a new commit**, then require a fresh integrated-PR validation. Do not treat a retry of the old SHA as permission to merge a new tree.
5. If `main` changed, ensure strict up-to-date merge requirements cause the PR to be updated and checked against current `main`. Do not bypass `quality` or use a green earlier run as evidence.
6. Preserve Full CI for manual dispatch, sensitive/unknown/config changes, and unsafe Git history. For verified allowlisted frontend/backend source pushes, require the impacted lanes; reuse an earlier Full PR E2E only after #794 proves identical tree plus passing provenance. Keep the exact-SHA Production Release Verification independent.

## Metrics and evidence to capture

For each representative run record: event, PR head and verified merge SHA, `quality` verdict, required/skipped lanes, actual results, reasons, job elapsed times, total runner-minutes, re-run attempts, critical path (typically Functional E2E on source changes), and deployment identity when available.

Calculate P50/P90 from a sufficiently large, comparable sample. Do not equate one docs-only selective canary to a full application-code PR. No automatic deletion of full post-merge validation is authorized by this document.

<!-- prettier-ignore-end -->
