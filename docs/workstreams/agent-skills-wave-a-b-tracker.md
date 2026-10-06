# Agent Skills Wave A-B Workstream

Status: **ACTIVE**

Updated: 2026-10-06

Execution branch: `agent/wave-a-agent-skills` / PR #525

Decision: Wave B is integrated into the same Agent Skills PR so both waves share one final CI/merge boundary and do not create an unnecessary stacked-branch wait.

## Scope

Complete the repository Agent Skills plan without reopening the paused Organization feature workstream.

### Wave A — upstream skills

- [x] `workers-best-practices`
- [x] `router-query` plus required `router-core` / `react-router` support skills
- [x] `codebase-design`
- [x] `improve-codebase-architecture`
- [x] `vite`
- [x] `vitest`
- [x] `security-guidance` plus vendored ASVS references
- [x] `frontend-accessibility-best-practices`
- [x] provenance/readme and root `AGENTS.md` selection rules
- [x] keep third-party vendored skill trees outside repository Prettier rewrites
- [ ] required CI passes and PR #525 merges

Wave A CI initially failed only because a newly disclosed high-severity `source-map-js@1.2.1` advisory was present in the inherited dependency graph. The remediation floors the vulnerable range at `1.2.2` and adds a narrowly scoped minimum-release-age exception for that security-fix version; audit thresholds remain unchanged.

### Wave B — RCAT-owned skills

- [x] `rcat-workstream-governance`
- [x] `rcat-cloudflare-d1`
- [x] `rcat-admin-ui`
- [x] `rcat-public-routing-ssr`
- [x] root `AGENTS.md` routing/selection rules updated
- [x] `.agents/skills/README.md` documents Wave B ownership and maintenance
- [ ] required CI passes and PR #525 merges

## Acceptance

1. Skills are present under `.agents/skills/` and contain valid skill metadata.
2. Generic upstream advice cannot override root `AGENTS.md`, current repository state, production safety, runtime ownership, or protected release gates.
3. Wave B skills point agents to canonical RCAT files instead of duplicating fast-changing project state.
4. No production deploy, D1 migration, production data mutation, Apps Script release, Vercel production release, or Organization implementation is performed by this workstream.
5. Final Wave A and Wave B PRs pass the repository-required CI/governance gates before merge.

## Current checkpoint

Wave A and Wave B implementation are complete on PR #525. The inherited `source-map-js` high-severity audit blocker is remediated without lowering audit policy. Wave A and Wave B implementation are complete on PR #525. The inherited `source-map-js` high-severity audit blocker is remediated without lowering audit policy. PR #525 is mergeable and auto-merge is enabled; the required CI/governance result for the live PR head remains the final acceptance boundary.

## Out of scope

- Organization content feature implementation remains paused.
- No architecture redesign or production mutation.


## Waiting state

- Resolve the live PR #525 head and its matching CI run from GitHub; do not rely on a previously recorded SHA/run after another tracker checkpoint commit.
- PR #525: mergeable with auto-merge enabled.
- No required gate has been bypassed.
- Exact next check: read PR #525 and the CI run for its current head. If merged with required CI green, update this tracker to `COMPLETE` on `main`; if CI failed, fix the failing current-head gate without weakening repository policy.
