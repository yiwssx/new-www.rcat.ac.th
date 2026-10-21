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
- [x] Add regression assertions for royal-award ordering, untruncated identity and compact touch controls.
- [x] Review branch diff; first CI completed all relevant gates except Prettier on the new ribbon test. Simplified the test formatting without changing application behavior.
- [ ] Verify exact-final-head CI (Prettier/lint/SSR/functional and aggregate quality).
- [ ] Merge only after required checks pass and record final SHA.
- [ ] Verify responsive rendering at 320/360/375/390/430px and desktop in a running browser; mark field QA separately.

## Evidence and next action

- Implementation and tests are committed on the task branch; no production mutation has been made.
- CI #4514 (`39546935095`) passed Dependency Preflight, Dependencies, Build, Governance, Integration, Unit, Functional E2E and Worker; Static Quality failed solely at `pnpm format:check` for `src/test/mourningRibbonLayout.test.ts`.
- The test formatting was amended in commit `617e82548c069e5800b1472d3ab71edf28aea496`; the follow-up CI run #4515 (`39547806134`) was still pending at the latest read. The tracker documentation update itself creates a newer head that also requires exact-head CI.
- Open a PR, inspect exact-head CI, correct any failures and wait for required gates. If field QA is unavailable, explicitly record it as unverified.
