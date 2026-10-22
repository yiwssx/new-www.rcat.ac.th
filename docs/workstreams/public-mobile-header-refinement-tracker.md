# Public mobile header refinement

- **Status:** ACTIVE — mobile visual acceptance correction after successful production verification
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

## Production field QA regression — 2026-10-21

- **Header delivery:** PR [#676](https://github.com/yiwssx/new-www.rcat.ac.th/pull/676) merged to `main@0f069849c617cd6c63ff0f90b740128ba1f3db94`. PR CI #4518 passed 10/10 gates. Vercel production deployment `dpl_yVosUXeRkcoxejZ7UpURPLkXP86G` is **READY**, serving `www.rcat.ac.th` and `rcat.ac.th`.
- **Field QA blocker:** [Production Verification #39550481365](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/39550481365) failed at Read-only Browser Field QA. Mobile Chromium 412px reports `documentOverflow=24`; the cookie consent `aside[aria-label="แจ้งการใช้คุกกี้"]` measured 436px and its Paper panel 420px. The run passed desktop/other mobile tests; the mobile root horizontal-overflow check failed twice.
- **Fix branch:** `fix/public-cookie-banner-mobile-overflow-677`. Constrain fixed cookie notice and Paper widths/box sizing and allow mobile action labels to wrap. Keep consent semantics, links, touch targets and privacy controls unchanged.
- **Regression:** Functional Playwright suite checks banner and document bounds at 320, 360, 412 and 430px while consent is unset.
- **PR:** [#678](https://github.com/yiwssx/new-www.rcat.ac.th/pull/678) fixes the cookie notice. CI #4521 (`39551507588`) passed Build, Unit, Integration, Functional E2E, Governance, Worker, Dependencies but failed Static Quality only on this tracker Markdown file. The malformed heading and orphaned paragraph are corrected here.
- **Verification pending:** Confirm exact-head CI including Static Quality, Functional E2E and aggregate quality, then merge and verify a new exact-SHA production Deployment and read-only Production Verification. **Do not claim the original field-QA failure is resolved before evidence.**

## Checkpoints

- [x] Read current `main`, project agent instructions, related components and ribbon tests.
- [x] Implement public shell, responsive ribbon clearance, menu and urgent ticker on task branch.
- [x] Preserve the royal-award ordering and complete identity in the public shell; adjust the existing ribbon regression test for mobile clearance.
- [x] Review branch diff; first CI completed all relevant gates except Prettier on the new ribbon test. Simplified the test formatting without changing application behavior.
- [ ] Verify exact-final-head CI (Prettier/lint/SSR/functional and aggregate quality).
- [x] Original header PR #676 merged with green CI to `main@0f069849`.
- [ ] Merge cookie-notice follow-up only after its required CI passes and record final SHA.
- [ ] Verify responsive rendering at 320/360/375/390/430px and desktop in a running browser; mark field QA separately.

## Evidence and next action

- Implementation and tests are committed on the task branch; no production mutation has been made.
- CI #4514 (`39546935095`) passed Dependency Preflight, Dependencies, Build, Governance, Integration, Unit, Functional E2E and Worker; Static Quality failed solely at `pnpm format:check` for `src/test/mourningRibbonLayout.test.ts`.
- CI #4515 (`39547806134`) and #4516 (`39547962217`) also reported Prettier formatting failures in the same test file. Replaced it with the formatter-clean baseline from `main` and a single updated padding expectation in commit `ba1ef3b6c184cb858b0b4158180eecfa2dc5a73b`.
- Await exact-head CI after this checkpoint commit, then inspect required jobs and merge only if all pass.
- Open a PR, inspect exact-head CI, correct any failures and wait for required gates. If field QA is unavailable, explicitly record it as unverified.

## Mobile visual acceptance — 2026-10-21

- **Feedback:** The latest mobile screenshot still has a large blank band below the mourning ribbon, an award caption stranded beside the logo, oversized full-width action blocks, and an empty-looking urgent ticker.
- **Implementation branch:** `fix/public-mobile-identity-visual-balance` based on production-verified `main@2caffa60`.
- **Design:** Keep the original royal-award caption in full above the mobile logo/name group; preserve its desktop placement, reduce only the mobile ribbon footprint and matching clearance, center compact 44px action targets, and constrain search width.
- **Urgent notices:** Keep the full CMS text, show an accessible icon-only category on phones, and begin the mobile ticker with text visible instead of waiting for it to enter from the far edge.
- **Regression coverage:** Ribbon size/clearance unit test, ticker timing tests, and Playwright geometry at 320/360/390/412/430px.
- **Acceptance gate:** Await exact-head CI, visual phone review, deployment and browser field QA. Previous CI and production success do not establish visual acceptance for this iteration.

## CI recovery — PR #679

- CI [#4529](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/39567838010) completed with Build, Unit, Integration, Functional E2E, Governance and Worker passing; Static Quality failed exclusively at `pnpm format:check` for `src/public/components/PublicSiteShell.tsx`. The aggregate `quality` job failed as a consequence.
- Mobile award icon JSX was normalized to the repository's 120-column Prettier configuration in commit `8152ca7bea2722991bc2e5c61dd9a85284ccf498`.
- Follow-up CI #4530 was started on that SHA, but this tracker checkpoint creates a newer head requiring exact-head CI again. No merge or production changes until the final-head quality gate is green; visual acceptance on an actual phone remains separate.

## Mobile top bar compact layout — 2026-10-22

- **Branch:** `fix/public-mobile-topbar-content-parity-compact`; PR #683.
- **Approved:** Keep desktop utility content fully visible on mobile; smaller contact typography.
- **Changed:** Mobile ribbon grid, full institution/contact/social details, theme-aware divider.
- **Unchanged:** White identity, royal award, desktop header, CMS/backend, dependencies.
- **Coverage:** Unit ribbon rules and Playwright mobile 320–430px plus desktop checks.
- **Recovery:** CI #4542 passed all lanes except Functional E2E (143/144). News page supplies
  preloaded site settings from the content endpoint, not only the shell endpoint.
  The Playwright fixture now injects the same settings into both endpoints.
- **Recovery 2:** CI #4545 passed all lanes except Functional E2E (143/144).
  The remaining desktop assertion matched both hidden mobile and visible desktop location text.
  Added an explicit desktop bar test identifier and scoped the assertion to it.
- **State:** PR #683 open; final-head CI and field visual QA pending before merge.

## Mobile top bar final verification — 2026-10-22

- **Status: COMPLETE (PR #683 scope).** PR #683 merged into `main` at
  `0510fa0b22ae41e480a4a1987ad6156ae7948018` (squash).
- **CI:** PR head `286927c68c0ebb901d5a9bcb30be0d6fc2a3e6bf`,
  Actions #4547, rerun success: all required jobs including Functional E2E
  and aggregate Quality passed.
- **Deployment:** Vercel Production deployment
  `dpl_AawKs35zzPVoVKBz4saTMuCopAQf` is READY for the exact merged SHA.
  Public `/rcat-release.json` reports the same SHA.
- **Production verification:** Workflow run #378
  (`39706759606`) completed successfully against the merged main SHA.
- **Read-only field QA:** After client hydration, the public mobile top bar
  displays college name, phone, email and three configured social links.
  At 320/360/390/412/430px the ribbon occupies its own 96px column;
  contact begins at x=102px and the utility bar fits the viewport.
  The desktop utility bar remains visible at desktop width.
- **Excluded follow-up:** An independent manual check found horizontal
  document overflow on the homepage from another content region.
  The mobile utility bar itself remains within viewport bounds.
  Investigate homepage overflow separately; it is not a failure of this
  compact utility bar change.

## Mobile floating ribbon and narrower contact header — 2026-10-22

- **Status:** PR #686 OPEN — final-head CI and field verification pending.
- **Branch:** `fix/public-mobile-ribbon-fixed-compact-20261022` (based on `main@3a598577d97ad33446b23d054dfbc234b96fa436`).
- **PR:** [#686](https://github.com/yiwssx/new-www.rcat.ac.th/pull/686). Initial CI #4561: Static Quality, Build, Integration, Dependencies, Governance and Worker green; Functional E2E and Unit still running at checkpoint. This tracker commit moves the head, so exact-new-head CI must be checked.
- **Request:** Reduce the crowded mobile top utility/header footprint; make the ribbon stay fixed on mobile as on desktop; remove the black triangular corner backdrop.
- **Implementation:** Reduce mobile ribbon from 96/112px to 64/72px without changing desktop sizing, tighten mobile contact spacing/padding, use `position: fixed` on every viewport, and replace the corner sash with a transparent-canvas round mourning-ribbon badge.
- **Protected constraints:** Preserve full Thai college/campus name, phone, email, social links, royal-award banner, existing actions, CMS settings, and desktop layout/clearance.
- **Tests:** Update unit assertions for dimensions/vector/fixed positioning; add functional fixed-position scroll checks at 320/390/1280px. Existing 320–430px content parity and overflow assertions remain.
- **Pending:** Confirm PR head, run required CI including Prettier/Functional E2E/quality, review mobile visual QA and desktop, and merge only with all applicable gates green. No production deployment performed here.

## Original ribbon artwork restoration — 2026-10-22

- **Status:** IMPLEMENTED — pending exact-head CI and visual field QA.
- **Branch:** `fix/restore-original-mourning-ribbon-no-sash-20261022`, based on `main@82a06d39e7dc6e5fb44dccae55c9b5dc4280f396`.
- **User correction:** Keep the **original** white-ring medallion and crossed mourning ribbon exactly as previously drawn; remove only the two dark triangular background/sash paths. The centered replacement art from #686/#687 is not accepted.
- **Implementation:** Restore the unchanged original circle and ribbon paths from pre-#686 `public/mourning-ribbon.svg@3a598577` in `public/mourning-ribbon-v3.svg`; exclude the two diagonal background paths. Point the active image and preload to v3 so cached v2 artwork cannot be reused.
- **Preserved behavior:** Mobile/desktop fixed ribbon on scroll, compact mobile header, contact and social links, royal-award information and existing desktop styling.
- **Coverage:** Vitest asserts the original circle geometry and both ribbon strokes, rejects triangular background and centered replacement art, and checks active asset/preload versions; existing Playwright mobile overflow and scroll checks remain.
- **Next:** Confirm PR-head CI, merge only after gates pass, verify deployment readiness and `www.rcat.ac.th` alias mapping to the merged SHA. Explicit browser visual acceptance remains a separate check.
