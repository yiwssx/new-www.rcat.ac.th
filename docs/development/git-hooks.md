# Git Hooks: Pre-commit Quality Checks

## What does the pre-commit hook do?

- Runs on every `git commit` (unless bypassed).
- Checks only staged files for lint and formatting issues.
- Uses `lint-staged` to run:
  - ESLint auto-fix and Prettier on staged JS/TS/TSX/MJS files.
  - Prettier on staged JSON, Markdown, CSS, HTML, YAML files.
- Prevents accidental commits of code with obvious lint/format errors.

## Why is the hook lightweight?

- Only runs on staged files, not the whole repo.
- Does **not** run tests, build, or full quality suite.
- Keeps commit workflow fast for developers.

## Why is `pnpm quality` still manual?

- Full quality checks (tests, build, all files) can be slow.
- Run `pnpm quality` before pushing or releasing to catch deeper issues.
- The hook is for fast feedback, not full validation.

## How to run checks manually

- Lint all code: `pnpm lint`
- Format all code: `pnpm format`
- Full quality suite: `pnpm quality`

## Emergency bypass

- You can bypass the hook with:
  ```sh
  git commit --no-verify
  ```
- **Warning:** Only bypass in emergencies. Fix issues before committing whenever possible.
