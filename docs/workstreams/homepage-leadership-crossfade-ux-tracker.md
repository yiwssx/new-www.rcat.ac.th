# Homepage Leadership Crossfade UX — Execution Tracker

**Issue:** [#622](https://github.com/yiwssx/new-www.rcat.ac.th/issues/622)
**Branch:** `feature/leadership-crossfade-polish-550ms`
**Base main:** `5059139c1c20d5976787ee1058fbbb26e22cb5a8`
**Status:** ACTIVE — IMPLEMENTATION IN PROGRESS (2026-10-15, Asia/Bangkok)

## Scope and acceptance

Approved: 550 ms Crossfade + Gentle Rise (6 px), unchanged six-second default leadership cadence, no added dependencies. Keep portrait, name, position, description as one consistent incoming/outgoing card. Warm next portrait before transitions, preserve current card while waiting for images, reduce flashing and reflow.

- [ ] T1 Layered crossfade and rise, cleanup on transition change/unmount, no remount flicker.
- [ ] T2 Warm images ahead, bound image failure/stalls; respect media gate and preserve fallback image behavior.
- [ ] T3 Preserve 6-second looping, manual arrows/keyboard, pause on hover/focus/hidden, reduced motion, director-only static view and responsive footprint.
- [ ] T4 Tests for overlap/550ms completion, loading delay, images failing, manual rapid clicks and reduced motion.
- [ ] T5 Exact-head CI quality, documentation, governed merge; operator field QA is separate from CI and not assumed.

## Implementation plan

Modify `src/public/components/home/HomepageLeadershipRotation.tsx` for a bounded dual-layer transition; optionally add a narrow image load-mode override to `DirectorHeroCard.tsx` to allow eager on-demand imagery in the homepage rotation. Extend adjacent Vitest/React Testing Library tests. Do not change other public carousels, Cloudflare Worker/D1, organization features, pnpm manifests, workflows or production deployments.

## Checkpoint

- Baseline inspected: `HomepageLeadershipRotation.tsx` directly replaces a single `DirectorHeroCard` at each interval without a visual transition or preloading. `PublicResponsiveImage` uses lazy loading by default for portraits.
- [x] Issue #622 created; dedicated branch created from reviewed `main`.
- [ ] Code/tests committed.
- [ ] PR opened and CI passed.
- [ ] Merge verified.
