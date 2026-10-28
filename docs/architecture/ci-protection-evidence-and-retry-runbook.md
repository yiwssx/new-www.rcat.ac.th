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

**P4 decision:** retain full `push main` CI. Before switching to post-merge targeted verification, verify denied direct push and stale-PR merge in a controlled test; prove the exact integrated commit and production artifact identity; confirm rollback, production smoke, and the remaining branch settings. Do not substitute a checked PR head SHA for the tested synthetic merge or final deployment SHA.

## Diagnosing a failed CI run

1. Open the failed `CI` workflow run and read the `Change Impact` summary, followed by the final `quality` summary. Check the planned-vs-observed table and listed gate errors.
2. Inspect the *first failing upstream lane*. A `quality` failure can be a consequence of another failed, cancelled, or unexpectedly skipped job.
3. For a transient runner/network failure with unchanged commit and unchanged required lanes, GitHub Actions **Re-run failed jobs** can preserve completed successful work. Re-evaluate the log afterwards.
4. For source, lockfile, workflow, base-branch, security, or integration changes, **fix and push a new commit**, then require a fresh integrated-PR validation. Do not treat a retry of the old SHA as permission to merge a new tree.
5. If `main` changed, ensure strict up-to-date merge requirements cause the PR to be updated and checked against current `main`. Do not bypass `quality` or use a green earlier run as evidence.
6. Preserve full CI on `workflow_dispatch` and `push main` until P4's production identity and safety criteria are proven.

## Metrics and evidence to capture

For each representative run record: event, PR head and verified merge SHA, `quality` verdict, required/skipped lanes, actual results, reasons, job elapsed times, total runner-minutes, re-run attempts, critical path (typically Functional E2E on source changes), and deployment identity when available.

Calculate P50/P90 from a sufficiently large, comparable sample. Do not equate one docs-only selective canary to a full application-code PR. No automatic deletion of full post-merge validation is authorized by this document.

<!-- prettier-ignore-end -->
