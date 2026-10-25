# Cloudflare Security Audit Skill Integration

Status: **ACTIVE — INTEGRATION PR PENDING CI**

Updated: 2026-10-25 (Asia/Bangkok)

Repository: `yiwssx/new-www.rcat.ac.th`

Baseline: `main` (verify live state before merge)

Integration branch: `chore/security-audit-skill`

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
- [ ] Open an integration PR to `main` and record the exact PR and head SHA.
- [ ] Verify vendored file inventory / SHA and Node validator self-tests where a safe runner is available.
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

Pinned upstream skill source is prepared for a vendor-only integration PR. No audit outcome or vulnerability is asserted. CI/merge, sandboxed pilot audit, and private remediation review remain pending.
