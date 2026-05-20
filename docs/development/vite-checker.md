# Vite Plugin Checker

## What it does

`vite-plugin-checker` provides an in-browser overlay and server-side diagnostics for developer checks while running `pnpm dev`.

This project enables development-time TypeScript checking so type errors surface while the Vite dev server is running.

## When it runs

- Runs automatically in the Vite dev server (`pnpm dev`).
- Intentionally disabled during production builds; it does not run during `pnpm build`.
- The plugin is dynamically imported only for Vite `serve` mode, so tests and production builds do not load the checker plugin.

## Enabled checks

- TypeScript checking using the project's existing `tsconfig.json`.

## ESLint checker

The ESLint checker is intentionally skipped.

Reason:

- The current project lint command allows warnings and currently reports an accepted React Compiler compatibility warning for TanStack Table usage.
- Enabling ESLint in the dev overlay would either duplicate full-repo lint work during development or require stricter warning behavior than `pnpm lint`, making the dev server noisier than the release gate.
- ESLint remains available through `pnpm lint` and the lightweight Husky + `lint-staged` pre-commit hook.

## What it does not replace

- Does not replace `pnpm quality` (full checks before release).
- Does not replace unit/integration tests or the production TypeScript check that runs during `pnpm build` (`tsc --noEmit -p tsconfig.json`).
- Does not change the existing build script semantics.
- Does not change runtime behavior, application code, auth, Apps Script, analytics, UI, or CMS schema behavior.

## Troubleshooting

- If the overlay appears too noisy, confirm the diagnostic is a TypeScript error from `tsconfig.json`.
- If the checker cannot find `tsconfig.json`, ensure `tsconfig.json` exists at project root.
- If `pnpm dev` feels slow, first check whether TypeScript diagnostics are repeatedly changing; the checker runs in a worker, but large type errors can still add noise.
- If ESLint feedback is needed while editing, run `pnpm lint` manually or rely on the pre-commit hook for staged files.

## How this differs from Husky + lint-staged

- `vite-plugin-checker` provides dev-time diagnostics while editing/running the dev server.
- Husky + `lint-staged` runs on `git commit` and only checks staged files to keep commits fast.
- Husky + `lint-staged` does not run `pnpm quality`, `pnpm build`, or integration tests.

## Commands

- Dev server: `pnpm dev`
- Run full lint: `pnpm lint`
- Format: `pnpm format`
- Full quality: `pnpm quality`
