# Organization Unit False-409 Hotfix Tracker

Status: **ACTIVE — CODE/REGRESSION TEST PREPARED, CI/RELEASE PENDING**

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

## Delivery state

- Implementation and regression-test commits prepared on isolated branch.
- **Pending**: exact-head CI, review/merge, authorized protected **Worker Production Release** on current `main` using the already-existing workflow `Deploy / Worker`, production smoke/revision verification with the operator.
- A Vercel READY build is not a substitute for protected Worker release; merging code alone cannot fix running Cloudflare Worker.
- No automatic Worker release or D1 writes are performed here unless the user explicitly authorizes the protected operation. Keep this tracker open until confirmed production resolution.

## Next

Open a scoped PR; wait for exact-head CI, and fix any failures without relaxing checks. After merge, arrange the protected Worker release using existing workflow only (never edit or bypass it). Confirm new unit save returns 200 and draft status persists, audit and revisions advance exactly once. Avoid re-clicking stale form saves until new release.
