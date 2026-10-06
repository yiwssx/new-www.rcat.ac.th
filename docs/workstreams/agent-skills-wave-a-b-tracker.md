# Agent Skills Wave A-B Workstream

Status: **ACTIVE**

Updated: 2026-10-06

Branch sequence:
- Wave A: `agent/wave-a-agent-skills` / PR #525
- Wave B: create from current `main` after Wave A merges

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

- [ ] `rcat-workstream-governance`
- [ ] `rcat-cloudflare-d1`
- [ ] `rcat-admin-ui`
- [ ] `rcat-public-routing-ssr`
- [ ] root `AGENTS.md` routing/selection rules updated
- [ ] `.agents/skills/README.md` documents Wave B ownership and maintenance
- [ ] required CI passes and Wave B PR merges

## Acceptance

1. Skills are present under `.agents/skills/` and contain valid skill metadata.
2. Generic upstream advice cannot override root `AGENTS.md`, current repository state, production safety, runtime ownership, or protected release gates.
3. Wave B skills point agents to canonical RCAT files instead of duplicating fast-changing project state.
4. No production deploy, D1 migration, production data mutation, Apps Script release, Vercel production release, or Organization implementation is performed by this workstream.
5. Final Wave A and Wave B PRs pass the repository-required CI/governance gates before merge.

## Current checkpoint

Wave A implementation is complete. Security remediation for the inherited `source-map-js` CI blocker has been committed to the Wave A branch. Await the authoritative CI result, merge Wave A, then create and complete Wave B from the resulting `main`.

## Out of scope

- Organization content feature implementation remains paused.
- No architecture redesign or production mutation.
