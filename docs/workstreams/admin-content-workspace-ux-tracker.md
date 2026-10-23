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
- [ ] Pass required CI checks and review the PR.

### UX-02: Full-page editor

- [ ] Create URL-addressable routes for new and existing content.
- [ ] Preserve existing save, draft recovery, and permission behavior.
- [ ] Support browser back, reload, and navigation confirmation.

### UX-03: Progressive editor settings

- [ ] Group publication, taxonomy, media, and SEO controls.
- [ ] Move the media picker out of the always-visible sidebar.
- [ ] Keep existing saved data fields and API contracts unchanged.

### UX-04: Responsive layouts

- [ ] Verify desktop, tablet, and mobile breakpoints.
- [ ] Make editing, toolbar actions, and media selection accessible.
- [ ] Remove excessive nested scrolling.

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
- 2026-10-23: Opened PR #697 with selective workspaces and tests.
