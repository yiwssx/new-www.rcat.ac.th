# RCAT Admin Content UX Tracker

Status: Implementation merged; authenticated production acceptance pending

Started: 2026-10-23 (Asia/Bangkok)

Repository: `yiwssx/new-www.rcat.ac.th`

Target branch: `main`

## Problem

- The admin content route mounted eight operational panels before the content list.
- The content editor is a long dialog with publishing, taxonomy, SEO, media, and uploads.
- A React SPA does not require a single long screen.

## Execution plan

### UX-01: Separate content workspaces

- [x] Make the content list the default workspace.
- [x] Keep all eight existing administration panels.
- [x] Group operational tools behind scrollable tabs.
- [x] Mount only the selected workspace to prevent unrelated requests.
- [x] Add regression tests for tab selection.
- [x] Pass required CI checks and merge PR #697.

### UX-02: Full-page editor

- [x] Add guarded `/admin/content/new` and `/admin/content/:contentId/edit` routes.
- [x] Reuse the existing editor form in full-page presentation mode.
- [x] Add list-page links while retaining the dialog as a transitional fallback.
- [x] Reuse save, upload, draft recovery, and permissions in the dedicated route.
- [x] Pass full-page editor CI and authenticated-fixture Playwright tests (#698).
- [ ] Perform manual visual QA while signed into the deployed admin.
- [x] Add SPA navigation guard for unsaved edits and synchronous draft preservation.
- [x] Verify navigation guard with CI Unit Tests and Playwright E2E in PR #700.
- [ ] Complete manual desktop/mobile admin UX sign-off using an authorized account.

### UX-03: Progressive editor settings

- [x] Keep publishing and taxonomy visible while hiding advanced SEO by default in full-page mode.
- [x] Show the media library and quick upload only on request in full-page mode.
- [x] Keep the existing dialog form fully expanded as a transitional fallback.
- [x] Move media controls into a dedicated modal for full-page editing.
- [x] Implement an accessible tabbed settings panel for publication, taxonomy, SEO and media in page mode.
- [x] Keep the legacy quick dialog's settings fields together without changing API data.
- [x] Add component and Playwright navigation checks for settings sections across viewports.
- [x] Confirm the focused settings tabs with passing unit, E2E, build and quality checks in PR #702.
- [ ] Verify settings tab behavior on the authenticated production editor.

### UX-04: Responsive layouts

- [x] Add compact-layout settings disclosure for the full-page editor under the desktop breakpoint.
- [x] Keep publishing settings visible alongside writing on desktop.
- [x] Keep save/confirm actions reachable with a sticky full-page toolbar.
- [x] Use the media dialog as the only scroll container in full-page mode and give it mobile viewport dimensions.
- [x] Add Playwright checks for 390px, 768px, and 1440px viewports.
- [x] Pass UX-04 CI including 390px, 768px and 1440px Playwright checks (PR #701).
- [ ] Verify no overflow or inaccessible controls on a deployed authenticated session.

### UX-05: Release validation

- [ ] Verify create, edit, review, publish, schedule, delete, and recovery.
- [ ] Verify RBAC and media upload permissions.
- [x] Complete unit, integration, build and governance checks for PR #697 through #701.
- [x] Complete final settings architecture PR #702 checks: unit, functional E2E, integration, build, static quality and governance.
- [ ] Complete authenticated production visual and role-based acceptance after deployment reaches READY.

## Guardrails

- Do not change D1 schema or Cloudflare API contracts for a layout fix.
- Do not remove revision history, redirects, taxonomy, or content governance.
- Do not bypass CI, bundle budgets, or branch protection.
- Revisit dynamic imports only after a measured editor-bundle optimization.
- Open one narrow PR per independent implementation slice.
- UX-01 retains the existing editor dialog; UX-02 handles editor routing.

## Progress

- 2026-10-23: Audited route composition and started UX-01.
- 2026-10-23: PR #697 merged after green CI, commit `de63d18d4f06bf61b59894348a05e7e940bf3c7e`.
- 2026-10-23: Started UX-02 with guarded editor routes and transitional list actions.
- 2026-10-23: PR #699 merged after green CI, commit `f270060bf6c2bc6a9f1008f3880f1abc6a09d01b`.
- 2026-10-23: PR #700 merged after green CI, commit `a9cfc61dfd6de5e9b73d0953d61f1890c925fdfa`.
- 2026-10-23: PR #701 merged after all required checks, commit `c7347f236bb465b22673f68aa28086d2c991bb8e`. Vercel reported Production READY for this commit.
- 2026-10-23: PR #702 merged after all required checks, commit `0831e647e511e347e5fcf75e4d2045b5706651cc`; awaiting confirmation of the production deployment and authorized final acceptance.

## Final acceptance checklist

- [x] PR #697-#702 merged with all required CI checks green.
- [x] CI covers core content create/edit links, publish and delete behavior, autosave recovery, settings tabs, mobile/tablet breakpoints and media panel accessibility.
- [x] Vercel deployment `dpl_HBiyho2ozfY6NqjxtTgYFfNSBWGU` is READY and matches PR #702 commit `0831e647e511e347e5fcf75e4d2045b5706651cc`.
- [ ] In an authorized production admin session, inspect new/edit on desktop, tablet and mobile for clipping, focus order, keyboard access and nested scrolling.
- [ ] With approved disposable content, verify the create -> edit -> review -> publish -> schedule -> delete lifecycle and recover an unsaved draft without affecting real announcements.
- [ ] Verify read-only/editor/publisher privileges and upload limits using appropriately authorized test accounts.
- [ ] Record production QA findings and close the tracker only after acceptance.

## Verification evidence

- PR #697-#701 merged previously with passing required checks.
- PR #702 merged with all 10 jobs successful: `0831e647e511e347e5fcf75e4d2045b5706651cc`.
- Playwright includes compact/mobile/tablet/desktop editor checks and focused publishing, taxonomy, SEO and media tabs.
- Vercel production READY confirmed for `0831e647e511e347e5fcf75e4d2045b5706651cc`; CI and deployment readiness are distinct from a manually authenticated acceptance test.

