# Organization Unit False-409 Hotfix Tracker

Status: **CLOSED — CI GREEN, MERGED, WORKER RELEASED, OPERATOR VERIFIED NO 409**

Date: 2026-10-12 Asia/Bangkok
Repository: `yiwssx/new-www.rcat.ac.th`
Branch: `fix/organization-unit-d1-trigger-write-confirmation`

## Incident

Users on `/admin/organization` report that changing a unit's publication status (including published → draft) produces a success-looking backend state after refresh yet a UI error: HTTP `409 stale organization revision`. A separate HTTP `428` is the **expected** password step-up, not the fault. Screenshots showed protected `X-RCAT-Expected-Revision: 1` and post-step-up 409. Do not reproduce or copy private session headers or tokens.

## Root-cause candidate, confirmed code defect

`cloudflare/public-api/src/db/organizationUnitLifecycle.ts` rejects a successful paired D1 write when `result[0].meta.changes !== 1`; D1 documents that `meta.changes` uses `sqlite3_total_changes()`, including the `content_revisions` immutable-history trigger. A single content UPDATE may therefore return `changes >= 2`. The route converts `false` into `409 stale organization revision` **after the database transaction has committed**. Existing tests used `StatementSync.run().changes` and missed trigger counts.

## Hotfix scope

- Keep existing authorization, step-up, revision CAS conditions, rollback-on-statement-failure and immutable audit.
- Confirm successful writes by a unique audit ID and the paired CMS/unit revision and timestamps **inside the same D1 batch** rather than `meta.changes === 1`.
- Regression: simulate D1 trigger-inclusive changes with SQLite `total_changes()`, prove successful publish/draft save and stale replay rejection.
- Strictly no changes to `.github/workflows/**`, secrets, D1 data, migrations, unrelated admin forms, deployment configuration, or direct production writes.

## Final delivery evidence

- [PR #571](https://github.com/yiwssx/new-www.rcat.ac.th/pull/571) merged into `main` on 2026-10-12 at 04:15:42 UTC; merge SHA `caec29bd7a1ad1d7c3b868d166246ff8c538c436`.
- [PR CI #38202764392](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38202764392) and [post-merge CI #38203065929](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38203065929): **success**, including regression, quality and Worker checks.
- [Protected Worker Production Release #38203813337](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38203813337): **success**, targeting the same `main` SHA. Released Worker version `39d9e1da-6867-4fd9-a4e2-bbd912693e56`; migration preflight reported no pending migrations.
- **Live acceptance:** site operator reported successfully testing the Organization unit save after release and confirmed **no HTTP 409**. This is operator-confirmed acceptance, not an independently executed authenticated browser test by the agent.
- Existing password step-up (HTTP 428), optimistic revision CAS and immutable audit protections remain enabled.
- No GitHub workflow edits, direct manual D1 changes, or production configuration changes were made by this hotfix.

## Closure

**Closed on 2026-10-12 by operator acceptance.** No additional action is pending in this false-409 workstream. The separate Organization personnel-assignment/pagination usability issue is outside this workstream and is **not** marked resolved here. Open a new scoped task or tracker if that issue requires remediation.
