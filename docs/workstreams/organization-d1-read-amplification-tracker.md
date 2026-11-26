# D1 Read Amplification & Organization Query Optimization

Status: **ACTIVE — NOT RELEASE READY**

Tracking issue: [#796](https://github.com/yiwssx/new-www.rcat.ac.th/issues/796).

Draft PR: [#797](https://github.com/yiwssx/new-www.rcat.ac.th/pull/797).

Branch: `fix/organization-d1-read-amplification`.

Baseline main: `95892c5f0e46a15f94c2caacb1b71b4472554a3c`.

## Production evidence

D1 Query Insights, 2026-11-23 through 2026-11-25 UTC: two organization SQL signatures accounted for 12,813,819 of 15,923,571 rows read (80.47%). The recursive step selected published contents before joining the parent, amplifying reads.

Read-only comparisons on 2026-11-26 at the same bound UTC instant:

- Hierarchy: 7,386 to 256 rows read; 60 ordered result rows exactly equal.
- Full positions: 9,825 to 2,298 rows read; 530 ordered result rows exactly equal.
- Full hierarchy plus positions: 17,211 to 2,554 rows read (85.16% reduction).
- Scoped positions: nine representative root, division and leaf cases returned exactly the ordered subset of baseline rows, with zero writes. Including hierarchy, totals ranged from 466 to 2,483 rows (85.57–97.29% reduction).
- Lightweight index reads only hierarchy (256 rows); default full response remains backward compatible.

These are SQL comparisons, not a post-deployment traffic-weighted daily reduction.

## Checkpoints

- [x] Production baseline and query attribution.
- [x] Explain and read-only result-equivalence comparison.
- [x] Enforce indexed parent traversal and indexed position joins.
- [x] Scope detail position reads to published descendants; preserve response shape and ordering.
- [x] Add opt-in lightweight index for menu and sitemap callers; preserve legacy full API.
- [x] Add D1 usage telemetry and query-plan, scoped detail, index/legacy contract tests.
- [x] Assess existing shared cache and invalidation: Organization is excluded from Worker shared-cache eligibility, and mutation invalidation does not cover organization/personnel. Keep existing 60-second response policy, do not introduce shared personnel caching without safe invalidation and privacy verification. Actual browser/CDN hit ratio remains unmeasured.
- [ ] Exact-head CI and regression verification, including repository formatting and security gates.
- [ ] Protected production release gate; no production mutation in source-code phase.
- [ ] Verify traffic-weighted production read reduction after separately authorized deployment; target at least 90%.

## Verification and next action

Initial CI [45733005932](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/45733005932) passed Worker, Unit Tests, Integration Tests, Build, Dependencies and Governance. Static Quality failed on tracker Markdown formatting only; aggregate quality failed and E2E was cancelled. Tracker formatting simplified in this checkpoint. New implementation and tests require exact-head CI. Previous test-only head was `ec8a47a41663918e2cb30afff55256d7feb2576e`; check the current PR head and its run, not the superseded run.

Local checkout and pinned formatter/test runner remain unavailable in this session. Do not mark tests passed or merge on that basis. Preserve all public response contracts, ordering, publication windows, contact consent and RBAC. No production writes, schema migrations, deploy, UI redesign or paid upgrade. Independent of issue #594.

Next: inspect exact-head CI, resolve failures without weakening gates, then prepare reviewed release candidate and preserve separate production approval. Record post-release daily read metrics only after actual deployment.
