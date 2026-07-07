# Major Dependency Update Plan

Captured: 2026-07-07T13:12:00+07:00

Base commit after patch/minor updates: `88c3b040d1e9cc959bda9826913afbd7325b9dce`

## Current Latest Candidates

`pnpm dlx npm-check-updates --target latest` reports these major candidates:

| Group                 | Packages                                                 | Current                                   | Latest                                               | Recommendation                                                                                                                  |
| --------------------- | -------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| React platform        | `react`, `react-dom`, `@types/react`, `@types/react-dom` | React 18, React types 18                  | React 19, React types 19                             | Defer to a dedicated React 19 compatibility pass.                                                                               |
| MUI platform          | `@mui/material`, `@mui/icons-material`                   | 6.5.x                                     | 9.2.x                                                | Defer until React 19 and MUI migration notes are reviewed together.                                                             |
| Vite/Vitest platform  | `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`        | Vite 6, Vitest 3, jsdom 26                | Vite 8, plugin-react 6, Vitest 4, jsdom 29           | Trial as an isolated tooling group because it may clear audit findings, but keep only if the full quality gate passes.          |
| Worker types          | `@cloudflare/workers-types`                              | 4.20260702.1                              | 5.20260707.1                                         | Blocked in this pass by the current Wrangler peer range; keep v4 until Wrangler accepts v5.                                     |
| Commit tooling        | `@commitlint/cli`, `@commitlint/config-conventional`     | 15.0.0                                    | 21.2.0                                               | Accepted in this pass; clears the `semver` advisory. Requires Node >=22.12 for local commitlint use.                            |
| Git hook tooling      | `lint-staged`                                            | 15.5.2                                    | 17.0.8                                               | Trial separately with a normal commit hook path.                                                                                |
| Repository AI tooling | `sigmap`                                                 | 6.15.0                                    | 8.9.1                                                | Defer unless `pnpm ai:health` and the Sigmap workflow are included in scope.                                                    |
| Runtime auth utility  | `bcryptjs` and `@types/bcryptjs`                         | `bcryptjs` 2.4.3, `@types/bcryptjs` 2.4.6 | `bcryptjs` 3.0.3, deprecated `@types/bcryptjs` 3.0.0 | Defer. Requires explicit server auth smoke testing and likely removing deprecated external types if bundled types are adequate. |
| TypeScript            | `typescript`                                             | 5.9.3                                     | 6.0.3                                                | Defer until Vite/Vitest and Worker tooling support is verified.                                                                 |

## Remaining Audit Findings After Patch/Minor

`pnpm audit` reports 3 advisories:

- High: `semver` via `@commitlint/cli > @commitlint/lint > @commitlint/is-ignored > semver`.
- Moderate: `brace-expansion` via ESLint/minimatch dependency paths.
- Low: `@babel/core` via `@vitejs/plugin-react`.

The commitlint and Vite/Vitest tooling trials should be prioritized because they directly target two of the three remaining advisory families.

After accepting the commit tooling major update, `pnpm audit` reports 2 advisories:

- Moderate: `brace-expansion` via ESLint/minimatch dependency paths.
- Low: `@babel/core` via `@vitejs/plugin-react`.

## Accepted Major Groups

- Commit tooling: `@commitlint/cli` and `@commitlint/config-conventional` were updated to `21.2.0`.
- Validation: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm commitlint --from HEAD~3 --to HEAD`, and `pnpm format:check` passed.
- Audit impact: the `semver` advisory was removed.
- Environment note: commitlint 21 declares `node >=22.12.0`; the local validation environment was Node `v25.8.2`.

## Blocked Major Groups

- Worker types: `@cloudflare/workers-types@5.20260706.1` passed `pnpm worker:typecheck` and the Worker unit-test subset, but `pnpm peers check` failed because `wrangler@4.107.0` requires `@cloudflare/workers-types@^4.20260701.1`. The v5 trial was reverted.

## Trial Order

1. Commit tooling: update `@commitlint/cli` and `@commitlint/config-conventional`; run `pnpm install --frozen-lockfile`, `pnpm lint`, and `pnpm audit`.
2. Worker types: update `@cloudflare/workers-types`; run `pnpm worker:typecheck`, `pnpm test:unit`, and `pnpm build`.
3. Git hook tooling: update `lint-staged`; verify the next commit runs the hook successfully.
4. Vite/Vitest platform: update `vite`, `@vitejs/plugin-react`, `vitest`, and `jsdom`; run the full quality gate and Playwright smoke tests.

## Deferred Groups

These groups should not be mixed into the warning/dependency cleanup branch unless the isolated trial proves clean:

- React 19 plus MUI 9 migration.
- `bcryptjs` 3 migration and `@types/bcryptjs` removal/replacement.
- TypeScript 6.
- Sigmap 8.

## Acceptance Criteria

- Keep a major group only if `pnpm format:check`, `pnpm lint`, `pnpm test:unit`, `pnpm test:integration`, `pnpm build`, and `pnpm worker:typecheck` pass after the group.
- Run `pnpm audit` after each accepted group.
- If a group fails, revert only that group and record the blocker in this document or a follow-up note.
- Do not change Worker runtime code, D1 migrations, Apps Script, or public behavior to force a dependency update through.
- Do not commit `public/robots.txt` or `public/sitemap.xml` changes as part of dependency work.
