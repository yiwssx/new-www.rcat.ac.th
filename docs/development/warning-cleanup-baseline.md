# Warning Cleanup Baseline

Captured: 2026-07-07T12:38:37+07:00

Current commit: `89f4ac81a3b372dfaca2f51ad8cdcee9c30b4fd0`

Branch: `chore/warnings-and-dependencies`

## Command Results

| Command                          | Result | Notes                                                                                                |
| -------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Pass   | Lockfile was already current.                                                                        |
| `pnpm format:check`              | Fail   | Prettier reported 52 files needing formatting.                                                       |
| `pnpm lint:report`               | Pass   | No ESLint warnings or errors were reported.                                                          |
| `pnpm lint:errors`               | Pass   | No ESLint errors were reported.                                                                      |
| `pnpm test:unit`                 | Pass   | 78 files, 592 tests. Unit run still emits test runtime warning noise.                                |
| `pnpm test:integration`          | Pass   | 1 file, 2 tests. Integration run emits the Vitest `--localstorage-file` warning.                     |
| `pnpm build`                     | Pass   | Build completed after the sitemap generator fell back to static routes because fetch failed locally. |
| `pnpm worker:typecheck`          | Pass   | Worker TypeScript project typechecked successfully.                                                  |
| `pnpm test:functional`           | Pass   | Playwright was installed; 2 smoke tests passed.                                                      |
| `pnpm audit`                     | Fail   | 16 advisories: 4 low, 5 moderate, 6 high, 1 critical.                                                |
| `pnpm outdated`                  | Fail   | Outdated packages were reported across runtime and dev tooling.                                      |

## Formatting Warnings

Prettier reported 52 files. The largest groups were:

- Worker source, Worker scripts, and Worker tests.
- Frontend service and feature modules.
- Admin/public React components and regression tests.
- Historical architecture and performance markdown.

These are mechanical formatting mismatches and should be fixed with targeted Prettier writes that avoid `public/robots.txt` and `public/sitemap.xml`.

## Test Runtime Warnings

The baseline unit and integration runs passed but emitted:

- Vitest/Node warning: ``--localstorage-file` was provided without a valid path`.
- React Router warning in selected public page tests: `useRouter must be used inside a <RouterProvider> component!`.
- React test warning in selected public data tests: suspended resources resolved outside `act(...)`.

These are test-harness warnings, not current lint or type failures.

## Audit Summary

`pnpm audit` reported 16 advisories:

- Critical: `vitest` UI server arbitrary file access advisory.
- High: `semver`, `ws`, `vite`, and `undici` advisories.
- Moderate: `ws`, `brace-expansion`, `vite`, and `undici` advisories.
- Low: `esbuild`, `@babel/core`, and `undici` advisories.

Most advisories route through development tooling such as Vitest, Vite, Wrangler/Miniflare, and transitive packages. The dependency update pass should re-run `pnpm audit` after each safe update group.

## Outdated Dependency Groups

Patch/minor candidates:

- Runtime: `dayjs`, `sweetalert2`, `@tanstack/react-query`, `@tanstack/react-router`.
- Dev tooling: `postcss`, `eslint`, `globals`, `@playwright/test`, `prettier`, `tailwindcss`, `@tailwindcss/postcss`, `typescript-eslint`, `wrangler`, `eslint-plugin-react-refresh`, `vite-plugin-checker`.

Major candidates that need separate planning:

- Runtime: `bcryptjs`, `@mui/icons-material`, `@mui/material`, `react`, `react-dom`.
- Dev tooling: `@cloudflare/workers-types`, `@commitlint/cli`, `@commitlint/config-conventional`, `jsdom`, `lint-staged`, `sigmap`, `@types/react`, `@types/react-dom`, `vite`, `@vitejs/plugin-react`, `vitest`.
- `@types/bcryptjs` reports a deprecated `3.0.0` latest and should not be upgraded blindly.

## Public Generated Files

`public/robots.txt` and `public/sitemap.xml` were dirty before this pass and are intentionally excluded from this cleanup. Build runs may regenerate `public/sitemap.xml`; validation should restore the pre-existing working-tree version before staging commits.
