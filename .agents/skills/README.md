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
| `frontend-accessibility-best-practices` | `sergiodxa/agent-skills` | `40e21b46189d5c7de6610b68a25280af863f8775` |

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
- Do not float skill content automatically from an upstream default branch.
- Skill updates are repository-maintenance changes and must pass the normal PR
  and CI/governance process.
- Adding a skill does not authorize dependency, architecture, deployment, or
  production changes by itself.
