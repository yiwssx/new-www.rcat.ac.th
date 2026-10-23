# RCAT Admin Content Workspace — UX Execution Tracker

- **Repository:** `yiwssx/new-www.rcat.ac.th`
- **Started:** 2026-10-23 (Asia/Bangkok)
- **Status:** In progress
- **Owner request:** Shorter, WordPress-inspired content administration with a dedicated writing workspace. Keep every existing CMS capability.
- **Target branch:** `main`
- **Implementation principle:** One focused PR per independently testable slice. Do not merge until required checks are green and the head SHA has been rechecked.

## Evidence / baseline

1. `src/routeComponents.tsx` maps `/admin/content` to `PreviewRevisionAutosaveWorkflowPage.tsx`.
2. That page previously mounted **eight** operational panels and guides in a vertical stack **before** `ContentPage`. This is the primary reason the default content page feels excessively long; it also mounts unrelated query consumers.
3. `ContentPage.tsx` maintains list search, filters, pagination, role-aware actions, recovery and publishing. It opens `ContentEditorDialog.tsx` for create/edit.
4. `ContentEditorDialog.tsx` (~1,606 lines at audit) combines blocks, publication metadata, SEO, media picker and quick upload in a large dialog. At mobile width its desktop two-column grid falls back to a single long column.
5. **Do not confuse SPA routing with the long-form layout problem.** React/TanStack Router should remain; information architecture and progressive disclosure must change.

## Work packages

### UX-01 — Decompose the content landing page

- **Status:** Implemented on branch; CI pending.
- **Scope:** Split content list, editorial operations, revision tools, taxonomy/redirects, and governance into selectable, lazy workspaces.
- **Acceptance:** Default `/admin/content` mounts content list only; all eight panels remain reachable; mobile tabs scroll; API and schema unchanged.

### UX-02 — Full-page content editor

- **Status:** Not started.
- **Scope:** Dedicated routes for creating and editing content.
- **Acceptance:** Direct URL, back navigation, and refresh work; no blocking dialog; loading/not-found and RBAC handled; list context retained.

### UX-03 — Progressive settings and separate media picker

- **Status:** Not started.
- **Scope:** Group editor settings by task, move media selection into its own overlay, and reveal advanced SEO when needed.
- **Acceptance:** All fields are preserved; save payload remains compatible; writing surface remains visible.

### UX-04 — Responsive editor and list

- **Status:** Not started.
- **Scope:** Improve phone and tablet layouts for writing, publishing, and table actions.
- **Acceptance:** No unmanageable nested scrolling; accessible media and settings controls; responsive layouts verified.

### UX-05 — Full integration and release verification

- **Status:** Not started.
- **Scope:** Test write operations, draft recovery, media, roles, publishing, scheduling, and deployment.
- **Acceptance:** Focused tests and CI green; manual authenticated QA completed.


## UX-01 implementation details

- Default tab: **รายการเนื้อหา**, preserving the `ContentPage` search, pagination and actions.
- Other tabs: **การตรวจทาน**, **ประวัติและเวอร์ชัน**, **หมวดหมู่และลิงก์**, **คุณภาพและกำหนดเวลา**.
- Mount and load components only after their tab is selected; do not remove the eight tools.
- Tabs are horizontally scrollable at narrow widths.
- Keep the existing content editing dialog unchanged in this first isolated slice, to avoid conflating navigation changes with write behavior.
- Navigation tab state is local in UX-01. URL-addressable subsections and full-page edit routes belong to UX-02.

## Safety boundaries

- No database migration, Worker/D1/API mutation, login/session/RBAC contract change or schema rewrite.
- Preserve revision history/compare, content health, scheduled publishing, redirects, taxonomy and legacy Facebook thumbnail recovery.
- Do not modify dependency versions, Renovate, deployment settings or unrelated public pages.
- Merge only after CI and focused tests pass; do not bypass branch protection.
- Avoid creating additional always-visible dashboards that recreate the scrolling problem.

## Verification checklist

- [x] Audit current components and route composition.
- [x] Define work packages and acceptance gates.
- [x] Implement on-demand workspaces for UX-01.
- [ ] Run focused component tests and TypeScript/lint/build checks.
- [ ] Verify role-aware behaviors and all workspace views on a running authenticated instance.
- [ ] Validate exact PR head SHA and merge only with green required checks.
- [ ] Begin UX-02 on a fresh branch after UX-01 is merged.

## Progress log

- **2026-10-23:** Identified eight always-visible operational panels as the main source of excessive vertical length. Started UX-01 with lazy, mutually exclusive workspaces; retained all original panels.
