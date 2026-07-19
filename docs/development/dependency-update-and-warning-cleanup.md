# Dependency Update and Warning Cleanup

This is the current dependency and warning-gate workflow. Use Node `24.18.0` and pnpm `11.13.0`, then install from the lockfile with `pnpm install --frozen-lockfile`.

## Commands

| Command                 | Purpose                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm lint:frontend`    | Lint React/frontend TypeScript.                                                            |
| `pnpm lint:server`      | Lint Vercel/API/server scripts and root config files.                                      |
| `pnpm lint:worker`      | Lint Worker source, tests, and Worker scripts.                                             |
| `pnpm lint:apps-script` | Lint Apps Script in its Google/shared-global environment.                                  |
| `pnpm lint:strict`      | Lint all active source with zero warnings allowed.                                         |
| `pnpm quality:full`     | Run format, strict lint, unit, integration, build, and Worker typecheck gates.             |
| `pnpm quality:release`  | Run `quality:full` and Playwright functional tests.                                        |
| `pnpm deps:outdated`    | Report direct dependency freshness; exit 1 is informational.                               |
| `pnpm deps:audit`       | Report all installed advisories.                                                           |
| `pnpm deps:check`       | Always run outdated and audit reports; enforce audit findings at high severity by default. |

Pass another threshold to the reporter when a stricter review is agreed, for example `pnpm deps:check -- --audit-level=moderate`.

## Safe Update Order

1. Record branch, HEAD, Node, pnpm, and pre-existing working-tree changes.
2. Run each baseline gate independently.
3. Use `pnpm why <package>` for every advisory or deprecation.
4. Prefer a patch/minor parent update. If an existing parent range already permits the fixed transitive release, refresh that transitive lock entry without an override.
5. Add a narrow override only when the upstream range cannot resolve a safe release and compatibility is demonstrated.
6. Run `pnpm audit`, strict lint, tests, build, Worker typecheck, peer checks, and `git diff --check` before keeping the change.
7. Handle major groups only in the dedicated plan below.

## Current Sitemap Note

`pnpm build` runs TypeScript and Vite only. Vercel serves `/sitemap.xml` through `api/sitemap.mjs`, backed by live Cloudflare Worker/D1 public data. The tracked `scripts/generate-sitemap.mjs` file is obsolete and unreferenced; it is retained only for a separately scoped removal decision. `public/sitemap.xml` is not generated or source-controlled.

## Acceptance Rules

- Do not suppress warnings to make a gate green.
- Do not change application behavior to force a dependency update.
- Do not combine React, MUI, Vite, Vitest, jsdom, TypeScript, bcryptjs, Sigmap, Wrangler, or Worker-types major upgrades with routine cleanup.
- Do not change Worker runtime, D1 migrations/schema, Apps Script runtime, auth architecture, or API contracts in a dependency-only pass.
- Document all remaining advisories and deprecated transitives with their path and deferred condition.
