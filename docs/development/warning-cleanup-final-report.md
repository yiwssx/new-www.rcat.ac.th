# Warning Cleanup Final Report

> **Historical snapshot (2026-07-19).** The Node `22.23.1` / `22.x` runtime statements below describe the validated repository state at that dated checkpoint and are not the current toolchain contract. Current source of truth: Node `24.x` (currently pinned by `.node-version`) and pnpm `10.34.5`, as documented in `docs/deployment/runtime-deployment-guide.md` and `docs/architecture/current-runtime-ownership.md`.

Verified: 2026-07-19 (Asia/Bangkok)

Baseline commit: `80324e71982411c67e6f3f9b66e06b09ab7bb282`

Historical runtime contract at this checkpoint: Node `22.23.1` (`22.x` engine), pnpm `10.34.5`

## Resolved

- Patched `brace-expansion` from `5.0.5` to `5.0.7` and `@babel/core` from `7.29.0` to `7.29.7` within existing parent ranges; no override was added.
- Aligned `package.json`, `.node-version`, and GitHub Actions with the then-current Vercel-compatible Node 22/pnpm 10 contract supported by Commitlint, lint-staged, ESLint, Vite, Vitest, and Wrangler.
- Migrated MUI 6.5 deprecated TextField, Drawer, and ListItemText props to slot props with focused accessibility/keyboard tests.
- Corrected the stale selected-slide unit assertion and the Playwright fixture/site-name contract without changing carousel behavior.
- Replaced a date-sensitive event-card assertion and a preview-binding test that required a real D1 identifier with stable, safe contracts.
- Kept fail-closed public analytics diagnostics in production source while asserting and restoring their `console.warn` spies in tests.
- Expanded ESLint coverage across frontend, server/Vercel, Worker source/tests/scripts, and Apps Script.
- Added a dependency reporter that always runs both `outdated` and `audit`; outdated findings remain informational and audit enforcement defaults to `high` severity.
- Reconciled runtime sitemap, architecture, deployment, environment, and historical documentation.

## Vercel Toolchain Correction

- Remote build logs for `452eb0e15b871be1212868f4a93fa62a9e834bd8` were unavailable because the existing Vercel integration and local CLI token were not authorized for the linked project. No deployment command was run.
- A clean detached worktree at that exact commit reproduced the first project failure: pnpm 11 exited with `ERR_PNPM_IGNORED_BUILDS` for `sharp@0.34.5`.
- At this historical checkpoint, the validated Vercel path used Node `22.23.1` / `22.x` and pnpm `10.34.5`; this statement is retained as evidence of that 2026-07-19 correction, not as the current Node requirement.
- Clean, frozen, and strict-peer frozen installs passed with the pnpm 10 workspace policy. pnpm 10 found the lockfile current, so no dependency snapshot or integrity entry changed.

## Remaining and Deferred

- Installed deprecated transitives remain: `git-raw-commits@5.0.1` through Commitlint and `whatwg-encoding@3.1.1` through jsdom. Removing either requires its upstream parent to migrate or a separately validated major update.
- Direct major upgrades for React/MUI, Vite/Vitest/jsdom, TypeScript, bcryptjs, Sigmap, and Worker types remain deferred to dedicated compatibility work.
- pnpm 11 is not used because the repository intentionally pins the validated `pnpm@10.34.5` contract.
- `pnpm-workspace.yaml` is intentionally tracked with pnpm 10's `onlyBuiltDependencies` allowlist and `strictDepBuilds: true`. `sharp@0.34.5` is approved because Wrangler -> Miniflare requires its install check; `esbuild` and `workerd` retain their required toolchain binary installers. Broad dependency scripts remain disabled, and the policy was validated by frozen-lockfile installation.
- The preserved local `cloudflare/public-api/wrangler.toml` edit at the historical checkpoint continued to trigger repository security guard tests in the main working tree. Task changes were validated separately from that user-owned configuration, and the file was excluded from every task commit.

## Warning Status

- ESLint: zero warnings across all four lint domains.
- TypeScript, Vite build, Worker typecheck: no warnings.
- Targeted MUI, carousel, sitemap, router integration, and Playwright runs: no React `act`, router-provider, expected-console, fallback, bundle, Node experimental, Wrangler, or Clasp warning leaked.
- Apps Script lint exceptions are configuration-level and limited to its shared global scope, external entrypoints, and intentional control-character validation expressions.

## Final Validation

The candidate patch was validated with the committed safe Wrangler placeholders and the tracked narrow dependency-build allowlist. This separates task results from the user-owned deployment identifiers in `cloudflare/public-api/wrangler.toml`.

| Command                                                                | Result                                                                                             |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                       | Passed; no engine, peer, deprecation, or ignored-build warning.                                    |
| `pnpm format:check`                                                    | Passed.                                                                                            |
| `pnpm lint:strict`                                                     | Passed with zero warnings across frontend, server, Worker, and Apps Script.                        |
| `pnpm lint:frontend`, `lint:server`, `lint:worker`, `lint:apps-script` | Each passed independently.                                                                         |
| `pnpm test:unit`                                                       | 112 files and 937 tests passed; no stderr, React `act`, or router warning signal.                  |
| `pnpm test:integration`                                                | 1 file and 2 tests passed.                                                                         |
| `pnpm test:sitemap`                                                    | 1 file and 5 tests passed.                                                                         |
| `pnpm build`                                                           | Passed; 1,345 modules transformed with no build warning.                                           |
| `pnpm worker:typecheck`                                                | Passed.                                                                                            |
| `pnpm test:functional`                                                 | 5 tests passed.                                                                                    |
| `pnpm deps:peers`                                                      | Frozen strict-peer installation passed with no peer dependency issues.                             |
| pnpm 11 read-only `peers check` diagnostic                             | No peer dependency issues.                                                                         |
| `pnpm audit`                                                           | No known vulnerabilities.                                                                          |
| `pnpm deps:check`                                                      | Passed; outdated exit 1 was reported, audit still ran and exited 0 at the enforced high threshold. |
| `git diff --check`                                                     | Passed.                                                                                            |

## Deployment Impact

- At the 2026-07-19 checkpoint, Vercel redeployment was required after the corrective toolchain commit was pushed.
- Cloudflare Worker deployment was not required; Worker runtime source was unchanged.
- D1 migration was not required; no migration or schema changed.
- Apps Script deployment was not required; `.gs` runtime source was unchanged.
- Documentation/CI-only changes required no runtime deployment.

See [current warning inventory](./current-warning-inventory.md) for the concise status table and [dependency governance](../maintenance/dependencies.md) for the active maintenance policy. For current runtime/toolchain requirements, use `docs/deployment/runtime-deployment-guide.md` rather than this historical report.
