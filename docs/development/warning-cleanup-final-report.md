# Warning Cleanup Final Report

Verified: 2026-07-19 (Asia/Bangkok)

Baseline commit: `80324e71982411c67e6f3f9b66e06b09ab7bb282`

Runtime contract: Node `24.18.0`, pnpm `11.13.0`

## Resolved

- Patched `brace-expansion` from `5.0.5` to `5.0.7` and `@babel/core` from `7.29.0` to `7.29.7` within existing parent ranges; no override was added.
- Aligned `package.json`, `.node-version`, and GitHub Actions with the Node/pnpm versions supported by Commitlint, lint-staged, ESLint, Vite, Vitest, and Wrangler.
- Migrated MUI 6.5 deprecated TextField, Drawer, and ListItemText props to slot props with focused accessibility/keyboard tests.
- Corrected the stale selected-slide unit assertion and the Playwright fixture/site-name contract without changing carousel behavior.
- Replaced a date-sensitive event-card assertion and a preview-binding test that required a real D1 identifier with stable, safe contracts.
- Kept fail-closed public analytics diagnostics in production source while asserting and restoring their `console.warn` spies in tests.
- Expanded ESLint coverage across frontend, server/Vercel, Worker source/tests/scripts, and Apps Script.
- Added a dependency reporter that always runs both `outdated` and `audit`; outdated findings remain informational and audit enforcement defaults to `high` severity.
- Reconciled runtime sitemap, architecture, deployment, environment, and historical documentation.

## Remaining and Deferred

- Installed deprecated transitives remain: `git-raw-commits@5.0.1` through Commitlint and `whatwg-encoding@3.1.1` through jsdom. Removing either requires its upstream parent to migrate or a separately validated major update.
- Direct major upgrades for React/MUI, Vite/Vitest/jsdom, TypeScript, bcryptjs, Sigmap, and Worker types remain deferred to dedicated compatibility work.
- The pnpm self-update notice is informational; the repository intentionally pins the validated `pnpm@11.13.0` contract.
- `sharp@0.34.5` is a Wrangler -> Miniflare transitive. The preserved user-owned `pnpm-workspace.yaml` edit narrowly approves its install script, so the final working tree installs cleanly; the approval remains intentionally outside these task commits.
- The preserved local `cloudflare/public-api/wrangler.toml` edit continues to trigger repository security guard tests in the main working tree. Task changes are validated separately from that user-owned configuration, and the file is excluded from every task commit.

## Warning Status

- ESLint: zero warnings across all four lint domains.
- TypeScript, Vite build, Worker typecheck: no warnings.
- Targeted MUI, carousel, sitemap, router integration, and Playwright runs: no React `act`, router-provider, expected-console, fallback, bundle, Node experimental, Wrangler, or Clasp warning leaked.
- Apps Script lint exceptions are configuration-level and limited to its shared global scope, external entrypoints, and intentional control-character validation expressions.

## Final Validation

The candidate patch was validated in a detached worktree using the committed safe Wrangler placeholders plus the unchanged local Sharp build approval. This separates task results from the user-owned deployment identifiers.

| Command                                                                | Result                                                                                             |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                       | Passed; no engine, peer, deprecation, or ignored-build warning.                                    |
| `pnpm format:check`                                                    | Passed.                                                                                            |
| `pnpm lint:strict`                                                     | Passed with zero warnings across frontend, server, Worker, and Apps Script.                        |
| `pnpm lint:frontend`, `lint:server`, `lint:worker`, `lint:apps-script` | Each passed independently.                                                                         |
| `pnpm test:unit`                                                       | 112 files and 937 tests passed; no stderr, React `act`, or router warning signal.                  |
| `pnpm test:integration`                                                | 1 file and 2 tests passed.                                                                         |
| `pnpm build`                                                           | Passed; 1,345 modules transformed with no build warning.                                           |
| `pnpm worker:typecheck`                                                | Passed.                                                                                            |
| `pnpm test:functional`                                                 | 5 tests passed.                                                                                    |
| `pnpm peers check`                                                     | No peer dependency issues.                                                                         |
| `pnpm audit`                                                           | No known vulnerabilities.                                                                          |
| `pnpm deps:check`                                                      | Passed; outdated exit 1 was reported, audit still ran and exited 0 at the enforced high threshold. |
| `git diff --check`                                                     | Passed.                                                                                            |

## Deployment Impact

- Vercel may be required if the dependency lockfile or frontend UI/test changes are accepted.
- Cloudflare Worker deployment is not required; Worker runtime source is unchanged.
- D1 migration is not required; no migration or schema changed.
- Apps Script deployment is not required; `.gs` runtime source is unchanged.
- Documentation/CI-only changes require no runtime deployment.

See [current warning inventory](./current-warning-inventory.md) for the concise machine-readable-style status table and [major dependency update plan](./dependency-major-update-plan.md) for deferred upgrades.
