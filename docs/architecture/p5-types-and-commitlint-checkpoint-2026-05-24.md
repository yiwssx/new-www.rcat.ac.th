# P5 Types and Commitlint Checkpoint - 2026-05-24

> Historical note, 2026-07-04: This checkpoint describes a previous migration state and is not the current runtime source of truth. Current runtime ownership has advanced: structured public/admin data uses Cloudflare Worker + D1, Apps Script is retained only for the Vercel-proxied Google Drive media/file bridge, cleanup is completed, preview field verification is in progress, and M20 production cutover remains gated.

## Executive Summary

- P5.1, P5.2, and the commitlint setup are safe to proceed from.
- Runtime behavior appears unchanged for public documents, visitor stats, cache keys, API wrappers, and Apps Script in the recent committed range.
- The project is ready for the next refactor step after this checkpoint.
- One safe cleanup was applied during the audit: type-only imports for the moved feature types were converted to `import type`.

## Type Split Verification

- `PublicDocumentItem`: defined only in `src/features/public-documents/types.ts`.
- `PublicDocumentListSnapshot`: defined only in `src/features/public-documents/types.ts`.
- `VisitorStatsSettings`: defined only in `src/features/visitor-stats/types.ts`.
- `src/types.ts` compatibility re-exports are intact for all three moved types.
- Duplicate definition searches found no duplicate interface or type definitions.
- Feature-local files now import moved feature types with type-only imports where appropriate.
- Circular dependency risk is low: feature type modules do not import from `src/types.ts`, and the feature folders did not show broad shared-type imports back into the feature type files.
- `src/types.ts` imports feature types only as type imports for compatibility and shared aggregate contracts.

## Runtime Preservation Checklist

- Public documents behavior unchanged: the document card rendering logic was not refactored.
- Public document cache key unchanged: `rcat.cms.public.document-list`.
- Public document cache TTL unchanged: `15 * 60 * 1000`.
- Visitor stats behavior unchanged: `DEFAULT_VISITOR_STATS` still defaults to disabled and zero counts with an empty `updatedAt`.
- `normalizeVisitorStats` still normalizes booleans, numeric counts, and `updatedAt` without response shape changes.
- `VisitorStatsCard` still renders `Who&apos;s Online` and reads `onlineUsers`.
- `git diff HEAD~3..HEAD -- src/services/googleApi.ts apps-script` showed no recent committed `googleApi.ts` or Apps Script implementation diff.
- Current working tree had pre-existing Apps Script modifications; this checkpoint did not edit Apps Script.

## Commitlint Verification

- Dependencies are present in `package.json` and `pnpm-lock.yaml`:
  `@commitlint/cli` and `@commitlint/config-conventional`.
- `package.json` includes the `commitlint` script.
- `commitlint.config.cjs` exists and extends `@commitlint/config-conventional`.
- `.husky/commit-msg` exists and runs `pnpm exec commitlint --edit "$1"`.
- Hook executable mode is `100755`.
- Valid message test passed under Git `sh`: `chore(commitlint): verify conventional commit enforcement`.
- Invalid message test failed as expected under Git `sh`: `bad commit message`.
- `docs/development/commit-convention.md` exists and explains the Conventional Commit format.
- Note: `pnpm.cmd exec commitlint --version` did not resolve local bins from PowerShell with pnpm 11.0.8, but the same `pnpm exec commitlint --version` command passed under Git `sh`, which matches the Husky hook execution environment.

## Commit History Check

Last 5 commits:

```text
f0b60f2 chore(commitlint): enforce conventional commits
b03baf6 refactor(types): move visitor stats settings type
4b913a0 Perform P5.1 small shared-types split: move public documents types into the public-documents feature module.
2ab9ba4 Perform G3 small API ownership split: move the public documents API wrapper out of src/services/googleApi.ts into the public-documents feature module.
a98fea8 Perform googleApi.ts ownership audit only.
```

The P5.2 visitor stats type split and commitlint tooling were separated by concern.

## Remaining Risks

- `src/types.ts` still contains many broad contracts.
- `googleApi.ts` still centralizes transport/API wrappers.
- Commitlint version is pinned; a future update may be considered later.
- No auto changelog tooling has been added yet.
- PowerShell `pnpm exec` local-bin resolution should be watched if developers run commitlint manually outside Git `sh`.

## Recommended Next Step

Proceed with G4 site-view API facade/split only after this checkpoint passes.

## Commands Run

| Command                                                                                                    | Result             | Notes                                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| `sigmap ask "P5.1 P5.2 type split and commitlint checkpoint audit files"`                                  | Failed             | `sigmap` was not available on PATH.                                                                       |
| `pnpm test:unit`                                                                                           | Passed             | 33 files, 264 tests. Existing router/localstorage/act warnings only.                                      |
| `rg "interface PublicDocumentItem\|type PublicDocumentItem" src`                                           | Passed             | Single definition in `src/features/public-documents/types.ts`.                                            |
| `rg "interface PublicDocumentListSnapshot\|type PublicDocumentListSnapshot" src`                           | Passed             | Single definition in `src/features/public-documents/types.ts`.                                            |
| `rg "interface VisitorStatsSettings\|type VisitorStatsSettings" src`                                       | Passed             | Single definition in `src/features/visitor-stats/types.ts`.                                               |
| `rg "PublicDocumentItem\|PublicDocumentListSnapshot\|VisitorStatsSettings" src`                            | Passed             | Compatibility and feature-local usage verified.                                                           |
| `rg "from \"../../types\"\|from \"../types\"\|from \"../../../types\"" src/features`                       | Passed             | No broad shared-type imports found after literal-pattern rerun.                                           |
| `rg "features/public-documents/types" src/types.ts`                                                        | Passed             | Compatibility import and re-export found.                                                                 |
| `rg "features/visitor-stats/types" src/types.ts`                                                           | Passed             | Compatibility import and re-export found.                                                                 |
| `rg "import .*PublicDocumentItem\|import .*PublicDocumentListSnapshot\|import .*VisitorStatsSettings" src` | Passed             | Feature-local imports are type-only after cleanup.                                                        |
| `rg "PUBLIC_DOCUMENT_LIST_CACHE_KEY\|PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS" src/features/public-documents`     | Passed             | Key and TTL unchanged.                                                                                    |
| `rg "DEFAULT_VISITOR_STATS\|normalizeVisitorStats" src/services/visitorStats.ts`                           | Passed             | Defaults and normalizer present.                                                                          |
| `rg "Who's Online\|onlineUsers" src/public/components/home/VisitorStatsCard.tsx`                           | Passed             | `onlineUsers` found; JSX renders escaped `Who&apos;s Online`.                                             |
| `git diff HEAD~3..HEAD -- src/services/googleApi.ts apps-script`                                           | Passed             | No recent committed implementation diff.                                                                  |
| `git ls-files -s .husky/commit-msg`                                                                        | Passed             | Mode `100755`.                                                                                            |
| `cat .husky/commit-msg`                                                                                    | Passed             | Runs `pnpm exec commitlint --edit "$1"`.                                                                  |
| `cat commitlint.config.cjs`                                                                                | Passed             | Extends `@commitlint/config-conventional`.                                                                |
| `pnpm exec commitlint --version`                                                                           | Passed in Git `sh` | Reported `@commitlint/cli@15.0.0`; PowerShell local-bin resolution failed.                                |
| `echo "chore(commitlint): verify conventional commit enforcement" \| pnpm exec commitlint`                 | Passed in Git `sh` | Valid message accepted.                                                                                   |
| `echo "bad commit message" \| pnpm exec commitlint`                                                        | Passed in Git `sh` | Invalid message rejected with `type-empty` and `subject-empty`.                                           |
| `git log --oneline -5`                                                                                     | Passed             | Type refactor and commitlint commits are separated.                                                       |
| `pnpm format:check`                                                                                        | Passed             | Prettier check clean.                                                                                     |
| `pnpm lint:report`                                                                                         | Passed             | ESLint report clean.                                                                                      |
| `pnpm lint:errors`                                                                                         | Passed             | ESLint quiet mode clean.                                                                                  |
| `pnpm test:integration`                                                                                    | Passed             | 2 files, 10 tests. Existing localstorage warning only.                                                    |
| `pnpm build`                                                                                               | Passed             | Sitemap generated with 8 URLs; Vite build passed. Existing bcryptjs browser externalization warning only. |
| `pnpm quality`                                                                                             | Passed             | Format, lint, unit, integration, and build passed.                                                        |

## Go / No-Go

GO.

- `pnpm quality` passes.
- Type definitions are unique.
- Compatibility re-exports work.
- Commitlint valid and invalid message tests behave correctly in the Husky/Git shell path.
- Hook mode is `100755`.
- No runtime/backend/API/cache/UI/googleApi behavior change was found in the audited scope.
