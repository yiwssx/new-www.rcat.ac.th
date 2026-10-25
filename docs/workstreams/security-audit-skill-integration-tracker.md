# Cloudflare Security Audit Skill Integration

Status: **ACTIVE — PR #711 OPEN; FIXING CI UNIT TEST DISCOVERY**

Updated: 2026-10-25 (Asia/Bangkok)

Repository: `yiwssx/new-www.rcat.ac.th`

Baseline: `main` (verify live state before merge)

Integration branch: `chore/security-audit-skill`

Integration PR: [#711](https://github.com/yiwssx/new-www.rcat.ac.th/pull/711) (open)

Upstream: `cloudflare/security-audit-skill@c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` (MIT)

## Goal

Vendor the complete pinned Cloudflare Security Audit Agent Skill into existing RCAT repository-scoped skills and establish an evidence-based, non-production pilot process without duplicating CI or reopening completed security workstreams.

## Scope and boundaries

- Add upstream `skills/security-audit/*` files without source modifications; include upstream MIT license and validator tests.
- Document usage and pin provenance in `.agents/skills/README.md`; add selection/safety rules in `AGENTS.md`; exclude unmodified vendor sources from Prettier rewriting.
- Preserve `security-guidance` (OWASP ASVS), existing CodeQL, Renovate, CI/security/governance and Production Verification workflows.
- Do not add dependencies, alter app/runtime source or production configuration, execute target-controlled code without a sandbox, call live endpoints, access production secrets/data, migrate D1, or deploy.
- A full six-phase audit requires independent agent assignments and an OS-enforced resource-limited no-network sandbox. This installation alone does not satisfy that prerequisite.
- Any unremediated finding is private under `SECURITY.md`; public trackers/PRs must contain process status only, not exploit evidence.

## Checkpoints

- [x] Review current `main` repository skills, CI, security and production boundaries.
- [x] Select and verify exact upstream commit, source file SHA equality and MIT license.
- [x] Prepare integration documentation and skill registration.
- [x] Open an integration PR to `main` and record the exact PR and head SHA.
- [x] Verify all 20 upstream vendored files and MIT license against pinned source blob SHAs.
- [ ] Verify vendored Node validator self-tests via a dedicated Node test-runner step in existing CI.
- [ ] Require current-head PR CI/governance green and approved protected-main merge.
- [ ] Conduct a separate **read-only, scoped** Pilot Audit for Admin auth/session/MFA, Worker RBAC/D1, and Vercel-to-Worker trust boundaries. Select `quick` or `standard` profile only if proper independent-agent and sandbox execution is available; otherwise perform a labeled preliminary static review and retain unverified leads as `needs_validation`.
- [ ] Privately triage confirmed findings, open separate narrow remediation PRs with regression tests, and verify required gates. Do not auto-merge security fixes or deploy.
- [ ] Record completion evidence and close this tracker when integration and pilot conditions are satisfied.

## Pilot acceptance

- Baseline SHA, scope, selected companions, execution profile, exclusions, and observed evidence are recorded without publishing unpatched exploit paths.
- No finding is called `confirmed` or assigned severity without source-grounded trust-boundary proof and independent review.
- Sandbox or independent-agent unavailability is stated clearly; do not fabricate six-phase outputs.
- Each approved remediation is isolated and tested; application behavior/production are unchanged by skill installation.

## Current checkpoint

PR #711 initial commit added the pinned skill at upstream `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` (21 unchanged source files including MIT license), docs and registration.

- PR head before CI correction: `268eccb622801dd88df0694d15a3405dae9b64ea`.
- [CI #40151869007](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40151869007) failed the aggregate `quality` check because Vitest discovered two vendored `node:test` suites as if they were Vitest tests; its 2,751 application tests passed, and other primary CI lanes passed.
- Fix under review: exclude vendored skill trees from Vitest discovery in `vite.config.ts`, and run both untouched upstream validator test suites using `node --test` in the existing Unit Tests lane.
- No runtime application behavior, dependencies, production state, or vulnerable-code claims changed.
- Integration merge, read-only scoped pilot security review, and private remediation triage remain pending.
