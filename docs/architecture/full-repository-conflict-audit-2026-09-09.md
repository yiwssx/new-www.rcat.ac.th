# Full Repository Conflict Audit — 2026-09-09

Status: remediation in progress through PR #261.

Canonical project state remains `docs/architecture/post-p5h-current-project-state.md`. This audit does not reopen historical M13-M21 phases or completed P6B/P6C/P6D work.

## Scope

The audit covered:

- current-facing project-state and runtime-ownership guidance;
- dependency policy, lockfile, generated dependency status, and security audit;
- Node/pnpm toolchain pins and current development guidance;
- GitHub Actions workflows, including completed-phase and protected production workflows;
- obsolete or explicitly unreferenced repository files;
- open pull requests, open issues, and branch state;
- compatibility surfaces that might look removable but still have an active consumer or backward-compatibility role.

## Remediated

### Dependency security and generated state

Master had two newly disclosed high-severity findings in the development/tooling tree while the production dependency tree remained clean:

- `wrangler -> miniflare -> sharp 0.35.2`, fixed by a narrow `sharp@<0.35.4 -> 0.35.4` override;
- `@commitlint/cli -> @commitlint/load -> cosmiconfig -> js-yaml 4.3.1`, fixed by a narrow `js-yaml@>=4.0.0 <4.3.2 -> 4.3.2` override.

The lockfile and `docs/maintenance/dependency-current-status.md` were regenerated from the repository toolchain. The resulting report records zero low, moderate, high, or critical findings for both the full tree and production tree.

The diagnostic workflow used to expose the audit JSON and regenerate state was temporary and was deleted before PR creation.

### Toolchain documentation drift

`.node-version` is `24.20.0`, `engines.node` remains `24.x`, and pnpm is pinned to `10.34.5`.

Current development guidance incorrectly referenced Node `24.18.0`. The current dependency workflow and environment-variable guide now use the repository pin. `src/test/repositoryHygieneConsistency.test.ts` guards this contract so a future Node pin change must update current guidance in the same change.

Historical measurements that mention older Node versions remain unchanged because they are evidence of earlier states, not current toolchain instructions.

### Obsolete sitemap generator

`scripts/generate-sitemap.mjs` was explicitly documented as obsolete and unreferenced. Current sitemap ownership is the Vercel runtime function `api/sitemap.mjs`; `pnpm build` does not generate `public/sitemap.xml`.

The obsolete build-time generator was deleted. The hygiene regression test now requires runtime sitemap ownership to remain single-sourced and requires the old generator to stay absent.

## Current-state conflict review

The current-facing state contract remains consistent:

- Phase 0: complete;
- Phase A: complete;
- Phase B: active because B3 Health Aggregation remains planned;
- B1 System Health Dashboard: complete;
- B2 Runtime Incident Feed: complete and production-verified;
- Phase C: complete;
- C3: production-verified and manual/protected only after closure;
- M13-M21: historical evidence, not active project phases;
- P6B, P6C, P6D and Admin UX 00-10: complete;
- governed dependency maintenance continues independently of feature-phase status.

`src/test/projectStateConsistency.test.ts` continues to reject stale active M20/M21 wording from current-facing guidance and protects the B1/B2/B3/Phase C contract.

## Historical records intentionally retained

Historical milestone, cutover, readiness, smoke, and audit documents were not deleted merely because they contain wording that was true at an earlier date. Files already marked as archived, historical, superseded, closure evidence, or compatibility evidence remain part of the audit trail.

In particular, old M20/M21 handoff wording must not be interpreted as current state. Current-state reporting is governed by the canonical post-P5H state document and the current-facing consistency test.

## Workflow review

No current workflow was identified as safe to delete solely because its originating implementation phase is complete.

Retained operational workflows include:

- CI and Format Guard;
- dependency monitoring and dependency-status synchronization;
- Phase A production browser smoke as the production read-only browser verification path;
- C3 authenticated CMS field verification as manual, master-only, protected production verification;
- P6B/P6C production security and reliability monitoring;
- D1 recovery drill and production observability workflows;
- Worker and Apps Script protected release/preflight/rollback workflows;
- Facebook metadata reclassification, which remains a protected production audit/apply tool rather than an abandoned one-time workflow.

The retired Worker-to-C3 automatic dispatch and the one-time C3 dispatcher remain absent. They must not be restored without a new explicit design decision.

## Compatibility surfaces intentionally retained

`VITE_PUBLIC_ANALYTICS_STRATEGY="both"` remains a deprecated compatibility alias for the canonical GTM transport. It is covered by code, types, documentation, and tests. Repository evidence does not prove that all external deployment environments have stopped using the alias, so removing it during cleanup would be an unjustified compatibility break.

`usePublicCmsSnapshot` also remains actively consumed by the public menu compatibility fallback and therefore is not dead code.

## Repository queue

At audit time there were no open GitHub issues.

Renovate PR #260 (`@playwright/test` `^1.63.0`) remained open. Its non-dependency CI lanes had passed, while its dependency lane inherited the same newly disclosed audit failure from master. It should be reevaluated against the remediated master after PR #261 lands rather than merged against the stale vulnerable dependency state.

## Closure criteria

This audit can be marked complete only when:

1. PR #261 passes all repository CI lanes and review-thread checks;
2. PR #261 merges to master;
3. master post-merge CI confirms the regenerated dependency state and hygiene tests;
4. the remaining Renovate queue is rebased/re-evaluated against the remediated master;
5. no new current-facing project-state conflict or failing required maintenance gate remains.
