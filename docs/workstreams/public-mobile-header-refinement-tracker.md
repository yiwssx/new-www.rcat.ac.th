# Public mobile header refinement

- **Status:** ACTIVE
- **Branch:** `fix/public-mobile-header-compact-royal-award`
- **PR:** Pending
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
- [ ] Review exact branch diff and Prettier/lint/SSR/functional CI results.
- [ ] Merge only after required checks pass and record final SHA.
- [ ] Verify responsive rendering at 320/360/375/390/430px and desktop in a running browser; mark field QA separately.

## Evidence and next action

- Current implementation is committed on the task branch; no production mutation has been made.
- Open a PR, inspect exact-head CI, correct any failures and wait for required gates. If field QA is unavailable, explicitly record it as unverified.
