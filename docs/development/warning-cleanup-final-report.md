# Warning Cleanup Final Report

Captured: 2026-07-07T14:15:00+07:00

Branch: `chore/warnings-and-dependencies`

## Completed

- Added repeatable warning/dependency workflow scripts: `lint:strict`, `quality:full`, `quality:release`, `deps:check`, `deps:update:minor`, `deps:update:latest`, and `warning:baseline`.
- Updated patch/minor runtime and tooling dependencies.
- Accepted major tooling updates for `@commitlint/cli`, `@commitlint/config-conventional`, and `lint-staged`.
- Reworked Vitest scripts through `scripts/run-vitest.mjs` so Node 25's experimental Web Storage is disabled during test runs. This removes the `--localstorage-file` warning without sharing a storage database across parallel test workers.
- Fixed browser timer handle types that were exposed by the dependency refresh.
- Removed TanStack router-provider warning noise from public page tests by partially mocking `useNavigate` where the public shell is rendered outside the app router.
- Added narrow timeout budgets to confirmed slow UI feedback/public detail tests that exceeded Vitest's 5s default under parallel load.

## Remaining Findings

- `pnpm audit` still reports 2 advisories:
  - Moderate `brace-expansion` through ESLint/minimatch dependency paths.
  - Low `@babel/core` through `@vitejs/plugin-react`.
- `pnpm outdated` still reports major candidates for React/MUI, Vite/Vitest/jsdom, TypeScript, `bcryptjs`, Sigmap, and Worker types.
- `@cloudflare/workers-types` v5 was trialed and reverted because `wrangler@4.107.0` still peers on `@cloudflare/workers-types@^4.20260701.1`.
- The public homepage information-architecture test still emits React Suspense `act(...)` warnings. A direct `act` wrapper was trialed and rejected because it made the lazy-section assertion brittle in this Vitest/jsdom environment.
- Public analytics and visitor-presence tests intentionally emit warnings for Cloudflare-only/no-op and missing preview schema fallback paths.
- Local `pnpm build` still reports the sitemap generator's static-route fallback when the live fetch is unavailable.

## Validation

| Command                      | Result | Notes                                                                                           |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| `pnpm format:check`          | Pass   | Prettier check clean.                                                                           |
| `pnpm lint`                  | Pass   | ESLint completed with no warnings.                                                              |
| `pnpm test:unit`             | Pass   | 78 files, 592 tests.                                                                            |
| `pnpm test:integration`      | Pass   | 1 file, 2 tests.                                                                                |
| `pnpm build`                 | Pass   | Public generated files were backed up/restored; local sitemap fetch fell back to static routes. |
| `pnpm worker:typecheck`      | Pass   | Worker TypeScript project typechecked successfully.                                             |
| `pnpm test:functional`       | Pass   | Chromium was installed for the updated Playwright version; 2 smoke tests passed.                |
| `pnpm peers check`           | Pass   | No peer dependency issues.                                                                      |
| `pnpm audit`                 | Fail   | 2 documented transitive advisories remain.                                                      |
| `pnpm outdated`              | Fail   | Major-only candidates remain.                                                                   |
| `pnpm lint-staged --version` | Pass   | Reports `17.0.8`.                                                                               |

## Public Generated Files

`public/robots.txt` and `public/sitemap.xml` were dirty before this pass and remain intentionally uncommitted. Build validation backed up and restored those files before staging.

## Deployment Impact

- Vercel deploy: required for the dependency/runtime bundle and frontend source/test harness changes to reach deployed builds.
- Worker deploy: not required. Worker behavior was not changed.
- D1 migration: not required.
- Apps Script deploy: not required.
