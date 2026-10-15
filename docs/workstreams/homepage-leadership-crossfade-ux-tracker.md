# Homepage Leadership Crossfade UX — Execution Tracker

**Issue:** [#622](https://github.com/yiwssx/new-www.rcat.ac.th/issues/622)
**Branch:** `feature/leadership-crossfade-polish-550ms`
**Base main:** `5059139c1c20d5976787ee1058fbbb26e22cb5a8`
**Status:** CLOSED — CODE MERGED; EXACT-HEAD CI GREEN (2026-10-15, Asia/Bangkok); PRODUCTION FIELD QA NOT VERIFIED

## Scope and acceptance

Approved: 550 ms Crossfade + Gentle Rise (6 px), unchanged six-second default leadership cadence, no added dependencies. Keep portrait, name, position, description as one consistent incoming/outgoing card. Warm next portrait before transitions, preserve current card while waiting for images, reduce flashing and reflow.

- [x] T1 Layered crossfade and rise, cleanup on transition change/unmount, no remount flicker.
- [x] T2 Warm images ahead, bound image failure/stalls; respect media gate and preserve fallback image behavior.
- [x] T3 Preserve 6-second looping, manual arrows/keyboard, pause on hover/focus/hidden, reduced motion, director-only static view and responsive footprint.
- [x] T4 Tests for overlap/550ms completion, loading delay, images failing, manual rapid clicks and reduced motion.
- [x] T5 Exact-head CI #38680755041 passed all lanes; PR #623 merged to main as 7e5d6f60f89e6774975d3d18145b5380d9bb46d8. Operator field QA is separate and not attested.

## Implementation plan

Modify `src/public/components/home/HomepageLeadershipRotation.tsx` for a bounded dual-layer transition; optionally add a narrow image load-mode override to `DirectorHeroCard.tsx` to allow eager on-demand imagery in the homepage rotation. Extend adjacent Vitest/React Testing Library tests. Do not change other public carousels, Cloudflare Worker/D1, organization features, pnpm manifests, workflows or production deployments.

## Checkpoint

- Baseline inspected: `HomepageLeadershipRotation.tsx` directly replaces a single `DirectorHeroCard` at each interval without a visual transition or preloading. `PublicResponsiveImage` uses lazy loading by default for portraits.
- [x] Issue #622 created; dedicated branch created from reviewed `main`.
- [x] Code/tests committed: rotation, narrow card image-load override, focused tests.
- [x] Exact-head CI #38680755041 passed after fixing react-hooks/set-state-in-effect in HomepageLeadershipRotation.tsx.
- [x] PR #623 opened and exact-head CI passed.
- [x] Merge verified: PR #623 merged, main commit 7e5d6f60f89e6774975d3d18145b5380d9bb46d8.

## Verified completion

- [PR #623](https://github.com/yiwssx/new-www.rcat.ac.th/pull/623) merged after exact-head [CI #38680755041](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38680755041) succeeded, including Static Quality, Unit, Integration, Functional E2E, Build, Worker, Dependencies and Governance.
- Static Quality failure in previous CI was traced to direct state updates inside a React effect. Fixed via media-query change event handling without relaxing the lint rule.
- No package/dependency, Cloudflare Worker/D1, workflow or production data changes were made.
- **Not attested:** Vercel production deployment or hands-on production visual QA; completion here means implementation and CI only.
