# Organization Legacy Sort-Order Normalization Tracker

Status: **CLOSED BY OWNER — CODE MERGED; PRODUCTION DATA NORMALIZATION NOT EXECUTED**

Updated: 2026-10-12 Asia/Bangkok

Repository: `yiwssx/new-www.rcat.ac.th`

Delivery branch: `fix/organization-legacy-order-normalization` (merged via PR #569)

## Objective and hard limits

Repair duplicate stored `sort_order` values among existing sibling organization units, positions within the same unit and position group, and assignments within the same position. Preserve the meaningful current order (`sort_order` followed by the existing read-model tie-break). The first record in a group legitimately retains database order `0`; the UI displays rank `1`.

The operator is using a phone and has explicitly forbidden changes to GitHub Actions workflows, deployment workflows, or unrelated systems. This workstream must not change `.github/workflows/**`, authentication, Worker routes, schema, personnel data, organization membership, or deployment configuration. **Do not automatically run anything against Production D1.**

## Checkpoint

- Inspected `main` SHA `9861d821bb47cfa6a224ccf6725a73d3ad83d19d`, the original Organization development tracker (closed), the schema, and organization sorting/query/revision rules.
- Confirmed the column defaults to zero; the actual defect for legacy data is _colliding sibling orders_, not a legitimate first item with `sort_order = 0`.
- Prepared `scripts/organization/legacy-order-preview.sql` for read-only proposed-row inspection.
- Prepared `scripts/organization/legacy-order-apply.sql` for **manual, protected, backup-first** normalization. Its organization-table UPDATE statements only affect duplicate-order groups and increment each affected row's optimistic-concurrency `revision`. For affected **units**, the paired CMS `contents` revision and modification metadata are also updated, preventing stale Admin edits; no migrations or Worker redeployment.
- **Verified:** PR #569 merged to `main` as `20cc80f7b9b26663487e110b8e83200e6c6061b6` on 2026-10-12; exact-head CI, post-merge [CI #38189340565](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38189340565), and [Production Verification #38189620003](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38189620003) completed successfully. The Vercel Production deployment for the same SHA was READY. These checks validate delivery, **not** a D1 data repair.
- **Not yet done:** production D1 identity/backup/Time Travel; actual private production preview; manual apply; post-apply verification.
- **Access boundary:** the connected GitHub tool can inspect/edit repository code but does not provide a protected Cloudflare D1 remote SQL execution session. Do not claim that the D1 records have changed.

## Protected run sequence — no workflow changes

1. Verify the exact target D1 identity through the existing `worker-production-preflight.mjs` and production-binding guard. Never point at the checked-in placeholder database UUID.
2. Read-only check that each Organization unit's `contents.revision` matches `organization_units.revision`; treat any mismatch as a blocker. Obtain the required protected environment permission and create both a D1 Time Travel checkpoint and a private SQL export; safeguard any personal information in the export.
3. Pause concurrent Organization Admin edits. Run `scripts/organization/legacy-order-preview.sql` read-only against the verified production D1; save/review the proposed changed rows and counts.
4. If the preview matches the authorized duplicate-only scope, manually execute `scripts/organization/legacy-order-apply.sql` on that _same_ D1 with the existing privileged/approved Wrangler context.
5. Re-run the preview: expect **zero proposed changes**. Independently check representative unit/position/assignment order in Admin and public rendering; collect outcome and release evidence.
6. If anything disagrees, stop and use the protected D1 Time Travel/backup recovery decision path. **Never silently rerun an unverified partial repair.**

## Final disposition — owner closure, 2026-10-12 Asia/Bangkok

- The repository owner explicitly instructed **close this workstream** after the delivery above. This tracker is now CLOSED; do not automatically resume the protected data operation, create a replacement tracker, or keep this as an active development task.
- **Delivered:** guarded read-only preview SQL, manually runnable duplicate-order normalization SQL, regression tests, runbook, and merged [PR #569](https://github.com/yiwssx/new-www.rcat.ac.th/pull/569). No GitHub Actions/workflow changes, Worker deployment, schema migration, or changes to organization personnel relationships.
- **Not delivered / not verified:** Production D1 identity, private backup/Time Travel snapshot, preview of actual records, write execution, and post-write verification. As of closure, **the production data is not known to have been normalized**; this code-only merge must never be represented as a successful data repair.
- The SQL and [protected manual runbook](../operations/organization-legacy-sort-normalization.md) remain available as reference for a future **separately authorized** operation, if required. Legitimate `sort_order = 0` first-in-group values are not a defect.
- No further action is scheduled under this closed workstream.
