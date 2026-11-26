# D1 Read Amplification & Organization Query Optimization

Status: **ACTIVE — NOT RELEASE READY**

Tracking issue: [#796](https://github.com/yiwssx/new-www.rcat.ac.th/issues/796)

Branch: `fix/organization-d1-read-amplification`

Baseline main: `95892c5f0e46a15f94c2caacb1b71b4472554a3c`.

## Evidence and scope

Production D1 Query Insights, 2026-11-23 through 2026-11-25 UTC: the two public organization query signatures accounted for 12,813,819 of 15,923,571 rows read (80.47%). The recursive step used the published-content search index before joining the parent, amplifying reads.

Read-only Production SQL comparison on 2026-11-26, same bound UTC timestamp:

| Query | Baseline rows read | Candidate rows read | Result count | Equality |
| --- | ---: | ---: | ---: | --- |
| Hierarchy | 7,386 | 256 | 60 | Exact |
| Positions | 9,825 | 2,695 | 530 | Exact |
| Combined | 17,211 | 2,951 | | |

Both candidate queries use the existing parent index in the recursive step. All comparison statements reported zero rows written. The combined single-pair reduction is 82.85%; this is not a deployed daily-usage result.

## Checkpoints

- [x] Production baseline and query-signature attribution.
- [x] Explain and read-only result-equivalence comparison of indexed traversal candidate.
- [x] Implement indexed traversal and existing D1 usage logger on isolated branch.
- [x] Add hierarchy query-plan regression test.
- [ ] Exact-head CI and regression verification (including repository formatting and security gates).
- [ ] Scope detail positions to the requested subtree; separate lightweight index callers without breaking the legacy contract.
- [ ] Assess cache hit ratio and safe invalidation including publication, expiration, personnel visibility and public contact consent.
- [ ] Measure additional reductions against matched workload; target at least 90% organization read reduction.
- [ ] Obtain separate protected release authorization, then verify matched production traffic after deployment.

## Guardrails and next action

Preserve all public response contracts, ordering, visibility and RBAC. No production writes, schema migrations, deployment, UI changes or paid plan upgrades authorized in this source-code phase. No additional indexes needed for the initial candidate. Independent of issue #594.

Initial implementation and query-plan test are committed. Local repository checkout and pinned formatter/test runner were unavailable in this session; CI remains required. Open draft PR, inspect exact-head CI, and continue the scoped-detail/index optimization before requesting protected release authorization.
