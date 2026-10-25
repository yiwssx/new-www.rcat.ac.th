# Repository Agent Skills

This directory vendors repository-scoped Agent Skills used by `new-www.rcat.ac.th`.
Repository policy in the root `AGENTS.md` remains authoritative when generic
upstream guidance conflicts with project-specific architecture, security,
release, or production constraints.

## Wave A primary skills

| Skill | Upstream | Pinned source |
| --- | --- | --- |
| `workers-best-practices` | `cloudflare/skills` | `41e0d19858946d18af9ee2c2feebbe2e11d829ff` |
| `router-query` | `TanStack/router` | `9595b9745dd3a34d283ebb6f6bacd5a82c2e43a1` |
| `codebase-design` | `mattpocock/skills` | `7a030a8b0dcaa601bb0dda9aaf174affb3d61145` |
| `improve-codebase-architecture` | `mattpocock/skills` | `7a030a8b0dcaa601bb0dda9aaf174affb3d61145` |
| `vite` | `antfu/skills` | `e53a142a2420e8cd812cfe9ed0484ab01bc856aa` |
| `vitest` | `antfu/skills` | `e53a142a2420e8cd812cfe9ed0484ab01bc856aa` |
| `security-guidance` | `OWASP/secure-agent-playbook` | `1b5fd4cff76075feb56d61ee2985e82516f8c53b` |
| `security-audit` | `cloudflare/security-audit-skill` | `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` |
| `frontend-accessibility-best-practices` | `sergiodxa/agent-skills` | `40e21b46189d5c7de6610b68a25280af863f8775` |

## Cloudflare security audit operation

The `security-audit` skill is vendored byte-for-byte from the pinned upstream `skills/security-audit/` directory, including companion guidance, the JSON report schema, coverage/findings validators, and their self-tests. The upstream MIT `LICENSE` is copied into the skill directory.

**Mode selection:** `security-guidance` applies OWASP ASVS during security-sensitive implementation. `security-audit` performs source-first, evidence-based review when requested. Ordinary code changes and PRs do **not** trigger a full six-phase audit. Use a bounded `quick` scoped pilot first for Admin auth/session/MFA, Worker RBAC/D1, and the Vercel↔Worker trust boundary. Record source commit and excluded paths; do not present scoped coverage as repository-wide assurance.

**Isolation:** Run the full audit only with independent sub-agents and an OS-enforced, no-external-network, resource-limited sandbox for executing target code. Without these controls, do not execute the target: retain the unresolved step as `needs_validation`. Do not scan the live website or Cloudflare/Vercel control planes. Keep unremediated vulnerability details out of public issues, PR descriptions, reports, workflow logs, and committed trackers; use `SECURITY.md` for private reporting.

**Workflow separation:** This skill is not installed as a GitHub Action and does not replace CodeQL, dependency scanning, OWASP guidance, CI quality checks, or existing production security verification. Remediation belongs in separate minimal PRs with regression tests and existing CI gates. Do not modify production systems or launch protected operations from this skill alone.

**Validator self-tests** (safe to run locally against the vendored code, without executing the application): `node --test .agents/skills/security-audit/validate-coverage-ledger.test.cjs .agents/skills/security-audit/validate-findings.test.cjs`.

## Wave B RCAT-owned skills

These skills are maintained in this repository rather than vendored from an
upstream project. They encode RCAT-specific execution and architecture
constraints while pointing to canonical repository files for mutable details.

| Skill                          | Ownership | Purpose                                                                                                       |
| ------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------- |
| `rcat-workstream-governance`  | RCAT      | Durable tracker/branch/PR/CI/merge and cross-session execution rules                                         |
| `rcat-cloudflare-d1`           | RCAT      | Worker/D1 ownership, migrations, protected production identity, release, rollback, and recovery               |
| `rcat-admin-ui`                | RCAT      | Admin MUI/Tailwind boundary, responsive UX, feedback, accessibility, states, and bundle governance            |
| `rcat-public-routing-ssr`      | RCAT      | Shared Public route registry, TanStack Router/Query, SSR/hydration, Vercel routing, SEO, sitemap, and slugs   |

RCAT-owned skills should avoid copying fast-changing PR, deployment, or release
status. They should reference root `AGENTS.md`, current project-state documents,
current workflows, and implementation files instead.

## TanStack support skills

`router-query` declares Router prerequisites. The upstream `router-core` and
`react-router` skill trees are vendored alongside it at the same pinned
TanStack commit. Relative cross-skill links were adjusted only to match the
flat repository skill layout.

## OWASP reference data

The OWASP `security-guidance` skill references ASVS material outside its
upstream skill directory. The referenced `data/asvs` files are vendored under
`security-guidance/data/asvs` so the skill is self-contained in this
repository.

## Maintenance

- Update a vendored skill deliberately and record the new upstream commit here.
- Review RCAT-owned skills when their canonical architecture or governance contract changes.
- Do not float skill content automatically from an upstream default branch.
- Skill updates are repository-maintenance changes and must pass the normal PR
  and CI/governance process.
- Adding a skill does not authorize dependency, architecture, deployment, or
  production changes by itself.
