# RCAT selective CI canary — 2026-10-28

Tracking issue: [#739](https://github.com/yiwssx/new-www.rcat.ac.th/issues/739).

This documentation-only change is an acceptance check for the selective CI workflow introduced in [PR #742](https://github.com/yiwssx/new-www.rcat.ac.th/pull/742). It does not change application runtime behavior, dependencies, or deployment settings.

Expected pull-request execution:

- Change Impact: success, with an audited documentation-only plan.
- Dependency Preflight: success.
- Static Quality: success.
- Dependencies, Unit Tests, Integration Tests, Build, Governance, Worker, Functional E2E: intentionally skipped.
- Required `quality`: success only when all planned skips match the observed job results.

A push to `main` remains subject to the full CI suite until P4 validates effective repository branch protection and pre-merge integration safeguards.
