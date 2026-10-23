# RCAT Admin Content UX Tracker

Status: In progress

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
- [ ] Run CI and authenticated visual QA for the full-page editor.
- [x] Add SPA navigation guard for unsaved edits and synchronous draft preservation.
- [x] Verify navigation guard with CI Unit Tests and Playwright E2E in PR #700.
- [ ] Complete authenticated manual visual QA on the deployed editor.

### UX-03: Progressive editor settings

- [x] Keep publishing and taxonomy visible while hiding advanced SEO by default in full-page mode.
- [x] Show the media library and quick upload only on request in full-page mode.
- [x] Keep the existing dialog form fully expanded as a transitional fallback.
- [x] Move media controls into a dedicated modal for full-page editing.
- [ ] Add a cohesive publishing/taxonomy/settings panel architecture.
- [ ] Verify on mobile and preserve existing saved fields and API contracts.

### UX-04: Responsive layouts

- [x] Add compact-layout settings disclosure for the full-page editor under the desktop breakpoint.
- [x] Keep publishing settings visible alongside writing on desktop.
- [x] Keep save/confirm actions reachable with a sticky full-page toolbar.
- [x] Use the media dialog as the only scroll container in full-page mode and give it mobile viewport dimensions.
- [x] Add Playwright checks for 390px, 768px, and 1440px viewports.
- [ ] Pass UX-04 CI and verify no overflow or inaccessible controls on a deployed authenticated session.

### UX-05: Release validation

- [ ] Verify create, edit, review, publish, schedule, delete, and recovery.
- [ ] Verify RBAC and media upload permissions.
- [ ] Run focused unit, integration, build, and governance checks.
- [ ] Complete authenticated visual QA before release.

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
- 2026-10-23: Started UX-04 with compact settings disclosure, mobile media dialog, sticky actions, and responsive browser regression tests.
