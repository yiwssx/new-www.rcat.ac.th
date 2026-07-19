# Warning Cleanup Baseline

Captured: 2026-07-19 (Asia/Bangkok)

Starting branch: `master`

Starting commit: `80324e71982411c67e6f3f9b66e06b09ab7bb282`

Runtime: Node `v24.18.0`, pnpm `11.13.0`

This is the current baseline for the warning/dependency cleanup. Older counts in dated checkpoint documents are historical measurements, not current repository results.

## Preserved Working-Tree State

Two user-owned edits existed before the baseline and were not changed or staged:

- `cloudflare/public-api/wrangler.toml`: local environment values. Security guard tests intentionally reject this tracked-file state; values are omitted here.
- `pnpm-workspace.yaml`: local `sharp` build approval.

## Fresh Command Results

| Command                          | Exit | Fresh result                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | ---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` |    0 | Lockfile already current; only the pnpm `11.13.0 -> 11.15.0` update notice printed. No engine, peer, or install deprecation warning printed.                                                                                                                                                                                                                |
| `pnpm format:check`              |    1 | Prettier identified 13 tracked files.                                                                                                                                                                                                                                                                                                                       |
| `pnpm lint:report`               |    0 | Zero warnings/errors in the old frontend/server-only scope. Worker and Apps Script were not covered.                                                                                                                                                                                                                                                        |
| `pnpm lint:strict`               |    0 | Zero warnings in the same incomplete old scope.                                                                                                                                                                                                                                                                                                             |
| `pnpm test:unit`                 |    1 | Fifteen tests failed: thirteen security guards rejected the preserved local Wrangler configuration, one stale carousel test expected a non-rendered slide image, and one date-sensitive event-detail assertion expected obsolete raw values. Expected fail-closed analytics diagnostics also leaked to stderr. No production source failure was identified. |
| `pnpm test:integration`          |    0 | Two tests passed when rerun independently. The initial concurrent baseline attempt produced one transient empty render and is not treated as the independent result.                                                                                                                                                                                        |
| `pnpm build`                     |    0 | TypeScript and Vite passed; 1,345 modules transformed. No sitemap fallback, browser-externalization, or bundle-size warning printed.                                                                                                                                                                                                                        |
| `pnpm worker:typecheck`          |    0 | Worker TypeScript passed.                                                                                                                                                                                                                                                                                                                                   |
| `pnpm test:functional`           |    1 | Four of five passed; the home smoke expected project settings while its installed fixture intentionally supplied another site name.                                                                                                                                                                                                                         |
| `pnpm outdated`                  |    1 | Twenty-four direct dependencies had newer releases; patch/minor and major candidates are separated in the major update plan.                                                                                                                                                                                                                                |
| `pnpm audit`                     |    1 | Two confirmed advisories: one moderate and one low.                                                                                                                                                                                                                                                                                                         |
| `pnpm peers check`               |    0 | No peer dependency issues.                                                                                                                                                                                                                                                                                                                                  |

## Confirmed Advisories

| Severity | Package/version         | Dependency path                                                                     | Patched version |
| -------- | ----------------------- | ----------------------------------------------------------------------------------- | --------------- |
| Moderate | `brace-expansion@5.0.5` | ESLint -> `minimatch@10.2.5` -> `brace-expansion` (41 reported paths)               | `>=5.0.6`       |
| Low      | `@babel/core@7.29.0`    | `@vitejs/plugin-react@4.7.0` and `eslint-plugin-react-hooks@7.1.1` -> `@babel/core` | `>=7.29.1`      |

## Deprecated Dependency Findings

- `git-raw-commits@5.0.1`: deprecated transitive dependency through `@commitlint/cli@21.2.0 -> @commitlint/read`; upstream replacement is `@conventional-changelog/git-client`.
- `whatwg-encoding@3.1.1`: deprecated transitive dependency through `jsdom@26.1.0 -> html-encoding-sniffer@4.0.0`.
- `@types/bcryptjs@2.4.6`: the installed release is not marked deprecated. `pnpm outdated` shows a deprecated `3.0.0` latest release, so it must not be upgraded independently of a future `bcryptjs` major migration.

## Source API Findings

MUI 6.5 marks these used props deprecated: `TextField.InputProps`, `TextField.inputProps`, `Drawer.PaperProps`, and `ListItemText.primaryTypographyProps`.

`Autocomplete.renderTags` and `@mui/material/Grid2` are supported by the installed MUI 6.5 types and are intentionally not migrated in this task.

## Sitemap Baseline

The current HEAD contains `80324e7 fix(seo): generate sitemap from live CMS routes`. Vercel rewrites `/sitemap.xml` to `/api/sitemap`; `api/sitemap.mjs` reads menu and published content from the Cloudflare public API. `pnpm build` does not run `scripts/generate-sitemap.mjs`. `public/sitemap.xml` is absent and untracked; `public/robots.txt` is tracked.
