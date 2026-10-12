# Organization Legacy Sort-Order Normalization Tracker

Status: **ACTIVE — SQL PREPARED; PRODUCTION DATA UNCHANGED**

Updated: 2026-10-12 Asia/Bangkok

Repository: `yiwssx/new-www.rcat.ac.th`

Branch: `fix/organization-legacy-order-normalization`

## Objective and hard limits

Repair duplicate stored `sort_order` values among existing sibling organization units, positions within the same unit and position group, and assignments within the same position. Preserve the meaningful current order (`sort_order` followed by the existing read-model tie-break). The first record in a group legitimately retains database order `0`; the UI displays rank `1`.

The operator is using a phone and has explicitly forbidden changes to GitHub Actions workflows, deployment workflows, or unrelated systems. This workstream must not change `.github/workflows/**`, authentication, Worker routes, schema, personnel data, organization membership, or deployment configuration. **Do not automatically run anything against Production D1.**

## Checkpoint

- Inspected `main` SHA `9861d821bb47cfa6a224ccf6725a73d3ad83d19d`, the original Organization development tracker (closed), the schema, and organization sorting/query/revision rules.
- Confirmed the column defaults to zero; the actual defect for legacy data is *colliding sibling orders*, not a legitimate first item with `sort_order = 0`.
- Prepared `scripts/organization/legacy-order-preview.sql` for read-only proposed-row inspection.
- Prepared `scripts/organization/legacy-order-apply.sql` for **manual, protected, backup-first** normalization. Its three UPDATE statements only affect duplicate-order groups and increment each affected row's optimistic-concurrency `revision`; no migrations or Worker redeployment.
- **Not yet done:** independent SQLite fixture tests; PR CI; production D1 identity/backup/Time Travel; actual private production preview; manual apply; post-apply verification.
- **Access boundary:** the connected GitHub tool can inspect/edit repository code but does not provide a protected Cloudflare D1 remote SQL execution session. Do not claim that the D1 records have changed.

## Protected run sequence — no workflow changes

1. Verify the exact target D1 identity through the existing `worker-production-preflight.mjs` and production-binding guard. Never point at the checked-in placeholder database UUID.
2. Obtain the required protected environment permission and create both a D1 Time Travel checkpoint and a private SQL export; safeguard any personal information in the export.
3. Pause concurrent Organization Admin edits. Run `scripts/organization/legacy-order-preview.sql` read-only against the verified production D1; save/review the proposed changed rows and counts.
4. If the preview matches the authorized duplicate-only scope, manually execute `scripts/organization/legacy-order-apply.sql` on that *same* D1 with the existing privileged/approved Wrangler context.
5. Re-run the preview: expect **zero proposed changes**. Independently check representative unit/position/assignment order in Admin and public rendering; collect outcome and release evidence.
6. If anything disagrees, stop and use the protected D1 Time Travel/backup recovery decision path. **Never silently rerun an unverified partial repair.**

## Next action

Validate the SQL against an isolated SQLite fixture (including revision triggers, no-op groups, multiple sibling scopes and idempotence), open and validate a scoped PR. Keep the production operation separate from the code merge.
