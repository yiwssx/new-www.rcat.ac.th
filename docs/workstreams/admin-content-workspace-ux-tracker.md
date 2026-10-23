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

| ID | Scope | Status | Acceptance criteria |
| --- | --- | --- | --- |
| UX-01 | Split content list, editorial operations, revision tools, taxonomy/redirects, and governance into selectable, lazy workspaces | Implemented on branch; CI pending | Default `/admin/content` mounts content list only; all eight existing panels remain reachable; accessible scrollable mobile tabs; no API/schema change |
| UX-02 | Dedicated full-page editor routes for new/edit | Not started | Direct URL/back/refresh function; no blocking dialog; RBAC + loading/not-found; preserve list context |
| UX-03 | Group editor settings by task; media picker in independent overlay; hide advanced SEO when not needed | Not started | No fields lost; consistent save payload; primary editing surface remains visible |
| UX-04 | Responsive editor and mobile list experience | Not started | No nested unmanageable scrolling; accessible media/settings controls; layout tested at phone/tablet/desktop widths |
| UX-05 | Comprehensive integration and deployment verification | Not started | Create/edit/publish/schedule/restore draft/media/permissions tests and manual authenticated QA; green CI, then release |

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
