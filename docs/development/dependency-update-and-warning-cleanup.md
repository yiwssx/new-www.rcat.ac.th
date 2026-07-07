# Dependency Update and Warning Cleanup

This project uses a staged dependency update process so warning cleanup and runtime changes stay reviewable.

## Scripts

| Script                    | Purpose                                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm warning:baseline`   | Captures the standard warning baseline: formatting, lint report, unit tests, integration tests, build, and Worker typecheck.                                         |
| `pnpm lint:strict`        | Runs ESLint with `--max-warnings=0` for files covered by the normal lint target.                                                                                     |
| `pnpm quality:full`       | Runs the full local non-browser quality gate: format, lint, unit tests, integration tests, build, and Worker typecheck.                                              |
| `pnpm quality:release`    | Runs `quality:full` plus Playwright functional smoke tests.                                                                                                          |
| `pnpm deps:check`         | Runs `pnpm outdated` and `pnpm audit`.                                                                                                                               |
| `pnpm deps:update:minor`  | Applies patch/minor dependency updates with `npm-check-updates`, then runs `pnpm install`.                                                                           |
| `pnpm deps:update:latest` | Applies latest dependency updates with `npm-check-updates`, then runs `pnpm install`; use only in a disposable branch or an intentionally scoped major-upgrade pass. |

## Update Order

1. Start from a clean branch, except for explicitly ignored generated files such as `public/robots.txt` and `public/sitemap.xml`.
2. Run `pnpm warning:baseline` or the individual baseline commands and record the results.
3. Fix mechanical formatting before accepting dependency updates.
4. Apply patch/minor updates with `pnpm deps:update:minor`.
5. Run `pnpm quality:full` and `pnpm deps:check`.
6. Commit only if validation passes or the remaining failure is a documented advisory that needs a major upgrade.
7. Review major updates with `pnpm dlx npm-check-updates --target latest` and group them by blast radius.
8. Apply major groups one at a time, validating each group before keeping it.

## Major Update Grouping

Use these groups when moving beyond patch/minor updates:

- React platform: `react`, `react-dom`, `@types/react`, `@types/react-dom`.
- MUI platform: `@mui/material`, `@mui/icons-material`, and any peer changes required by MUI.
- Vite/Vitest platform: `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `vite-plugin-checker`.
- Worker tooling: `wrangler`, `@cloudflare/workers-types`.
- Repository tooling: `@commitlint/cli`, `@commitlint/config-conventional`, `lint-staged`, `sigmap`.
- Runtime utilities: `bcryptjs`; remove `@types/bcryptjs` only if the selected `bcryptjs` version includes compatible bundled types and validation proves no type regression.

## Acceptance Rules

- Do not downgrade packages to satisfy a warning.
- Do not suppress warnings without proving the warning is a false positive or intentionally deferred.
- Do not change Worker, D1 migrations, Apps Script media bridge, or public runtime behavior as part of routine dependency updates.
- Do not commit generated `public/robots.txt` or `public/sitemap.xml` changes unless a separate sitemap/robots task explicitly owns them.
- Re-run `pnpm audit` after dependency changes and document remaining advisories with their dependency path.
- If a major group fails validation, revert only that group and document the blocker in the major update plan.

## Build Note

`pnpm build` runs `scripts/generate-sitemap.mjs` before TypeScript and Vite. Local builds can update `public/sitemap.xml`, so restore the pre-existing public generated files before staging unrelated dependency or warning cleanup commits.
