# Current Warning Inventory

Last verified date: 2026-09-11 (Asia/Bangkok)

Current baseline: `master` after operator-environment reconciliation and Reliability Roadmap v2 closure.

This file is the current warning/status inventory. The dated 2026-07-19 warning-cleanup files remain historical evidence and must not be used as the current Node, Wrangler, dependency, or CI contract.

## Current Contract

| Category               | Current status                                                                                                                      | Source of truth / action                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Toolchain              | Node `24.x`; `.node-version` pins `24.20.0`; pnpm `10.34.5`                                                                         | Keep `package.json`, `.node-version`, CI, and current development docs aligned.                                                            |
| Repository CI          | Latest reconciled `master` CI is green; there is no known current warning blocker represented by this inventory                     | Treat failing future CI as a new incident rather than reviving the 2026-07-19 local-warning state.                                         |
| Dependencies           | Governed by the generated dependency-status snapshot, Renovate policy, freshness checks, and security audits                        | Use `docs/maintenance/dependency-current-status.md` and `docs/maintenance/dependencies.md`; do not duplicate version status manually here. |
| Worker config          | Tracked `cloudflare/public-api/wrangler.toml` uses safe placeholders and the canonical production-in-place resource contract        | Keep the real production D1 UUID out of Git; production identity is verified by protected release tooling.                                 |
| Production environment | Local development plus one canonical remote production role; no persistent Cloudflare Preview tier                                  | Physical Worker/D1 name `rcat-public-api-preview` is historical naming only and is the current production resource.                        |
| CMS authentication     | CMS Session/RBAC/MFA/CSRF/step-up boundary active; legacy-only auth environment values retired                                      | Operator-verified on 2026-09-11; see `docs/operations/environment-retirement-verification-2026-09-11.md`.                                  |
| Complaint proxy        | Production Vercel uses server-only `COMPLAINT_API_URI`; retired `VITE_COMPLAINT_API_URI` is absent from the live Vercel environment | Server source may retain compatibility parsing, but the retired variable is not current Production configuration.                          |
| Reliability roadmap    | Phase 0, Phase A, Phase B/B1-B3, and Phase C complete; no active Reliability Roadmap v2 phase                                       | Use `docs/architecture/post-p5h-current-project-state.md` and `docs/architecture/reliability-roadmap-v2.md`.                               |

## Historical Warning Records

The following documents preserve earlier warning/toolchain checkpoints and are intentionally not rewritten as current state:

- `docs/development/warning-cleanup-baseline.md`
- `docs/development/warning-cleanup-final-report.md`

Statements there about Node 22, a user-owned Wrangler edit, or warning counts describe their dated checkpoints only.

## Maintenance Rule

Do not add a warning to this inventory merely because a dependency has a newer version. Dependency age and upgrade eligibility are governed by the repository dependency policy. Add an item here only when it is an actionable current repository/toolchain/runtime warning or an explicitly accepted current limitation.
