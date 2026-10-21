# Public mobile header refinement

- **Status:** ACTIVE
- **Branch:** `fix/public-mobile-header-compact-royal-award`
- **PR:** [#676](https://github.com/yiwssx/new-www.rcat.ac.th/pull/676)
- **Scope:** Public mobile top bar, college identity, mourning-ribbon clearance, primary actions/search, compact menu and urgent ticker; responsive regression checks.
- **Out of scope:** CMS content/settings, royal-award wording/year changes, Worker/D1, authentication, deployment and protected production operations.

## Decisions

- Use Concept A: preserve the full royal-award introduction **above** the Thai institution name.
- Preserve the complete Thai and English institution names; no mobile ellipsis.
- On mobile, display the two primary buttons side by side and the search field beneath them, each with a 44px touch height.
- Preserve the ribbon size and avoid horizontal indentation on the narrow identity row by clearing the ribbon vertically.
- Keep official RCAT color and existing public navigation routes and actions.

## Checkpoints

- [x] Read current `main`, project agent instructions, related components and ribbon tests.
- [x] Implement public shell, responsive ribbon clearance, menu and urgent ticker on task branch.
- [x] Preserve the royal-award ordering and complete identity in the public shell; adjust the existing ribbon regression test for mobile clearance.
- [x] Review branch diff; first CI completed all relevant gates except Prettier on the new ribbon test. Simplified the test formatting without changing application behavior.
- [ ] Verify exact-final-head CI (Prettier/lint/SSR/functional and aggregate quality).
- [ ] Merge only after required checks pass and record final SHA.
- [ ] Verify responsive rendering at 320/360/375/390/430px and desktop in a running browser; mark field QA separately.

## Evidence and next action

- Implementation and tests are committed on the task branch; no production mutation has been made.
- CI #4514 (`39546935095`) passed Dependency Preflight, Dependencies, Build, Governance, Integration, Unit, Functional E2E and Worker; Static Quality failed solely at `pnpm format:check` for `src/test/mourningRibbonLayout.test.ts`.
- CI #4515 (`39547806134`) and #4516 (`39547962217`) also reported Prettier formatting failures in the same test file. Replaced it with the formatter-clean baseline from `main` and a single updated padding expectation in commit `ba1ef3b6c184cb858b0b4158180eecfa2dc5a73b`.
- Await exact-head CI after this checkpoint commit, then inspect required jobs and merge only if all pass.
- Open a PR, inspect exact-head CI, correct any failures and wait for required gates. If field QA is unavailable, explicitly record it as unverified.
