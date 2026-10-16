# UX Content & Microcopy Cleanup — Execution Tracker

**Repository:** `yiwssx/new-www.rcat.ac.th`  
**Created:** 2026-10-16 (Asia/Bangkok)  
**Status:** **ON HOLD — PLAN ONLY, NOT AUTHORIZED TO IMPLEMENT**  
**Tracking issue:** [#634](https://github.com/yiwssx/new-www.rcat.ac.th/issues/634)  
**Planning baseline:** `main@326963d82416e818b5e7fa3d0389865737bbfc0c`  
**Planning branch:** `docs/ux-content-microcopy-cleanup-plan-20261016`  
**Implementation PR:** NONE; **CI / production verification:** NOT RUN.

## Objective / scope

Simplify technical and internal-facing text across RCAT public pages and routine Admin workflows without changing business behavior or impairing safety, accessibility, operational support, or advanced technical-administrator diagnostics.

**Public coverage:** home, news, announcements, content detail, blog, organization/departments, documents, contact, complaint, calendar, ITA, search, navigation, 404, empty/error/loading, responsive/accessibility text and content coming from CMS.

**Admin coverage:** dashboard, editorial content, media, documents, menus, organization, carousel, E-Service/social, settings, integrations, users/security, backup/restore, system health, confirmations and failures.

**Three audience tiers:** public reader; editorial staff; technical/system administrator. Internal status and jargon should not be exposed to the wrong audience, but technical support and actionable statuses must remain available where needed.

## Preliminary audit evidence (static source, not exhaustive field proof)

| Area | Confirmed source evidence | Intended review |
| --- | --- | --- |
| Public route descriptions | `src/public/components/PublicSiteShell.tsx`, `src/public/pages/{PublicBlogPage,PublicDepartmentsPage,PublicContactPage}.tsx` | Remove public references to CMS |
| Public content cards / detail | `src/public/components/PublicContentCard.tsx`, `src/public/pages/PublicContentDetailPage.tsx` | Remove redundant publication chips and generic system author metadata when not meaningful |
| Public jobs / procurement | `src/public/components/home/{JobOpportunitiesSection,ProcurementNewsSection}.tsx` | Remove redundant `เผยแพร่แล้ว` chips |
| Homepage headlines | `src/public/components/home/{HomeSectionHeading,ExternalServicesSection}.tsx` | Review `::` and mixed `Online Service Portal` / `E-Service` / Thai titles |
| Visitor stats | `src/public/components/home/VisitorStatsCard.tsx` | Consistent Thai labels for visitor figures / last update |
| Admin workflow guides | `src/admin/components/*WorkflowGuide.tsx` | Replace `WordPress-like` with task-centric steps |
| Admin settings / editor | `src/admin/pages/SettingsPage.tsx`, `src/admin/components/ContentEditorDialog.tsx` | Explain Hero/Intro Gate/slug/SEO in operator language; preserve editable functions |
| Admin organization | `src/admin/pages/OrganizationPage.tsx`, `src/admin/components/OrganizationUnitContextPreview.tsx` | Reduce jargon and implementation-oriented preview explanations |
| Admin backups & governance | `src/admin/pages/BackupPage.tsx`, `src/admin/components/{PortableBackupRecoveryPanel,EditorialWorkflowPanel}.tsx` | Make recovery/data-loss consequences readable; retain required security warnings |
| Admin health / integrations | `src/admin/pages/{SystemHealthPage,IntegrationsPage}.tsx` | Surface user-level state first, reserve technical details for expert users |

**Unverified:** production runtime, authenticated role-specific views, data-driven content and mobile breakpoints require separate later inspection. Two responsive E-Service placements are not confirmed duplication.

## Phase / checkpoint tracker

| ID | Deliverable | State |
| --- | --- | --- |
| T0 | Preliminary static code evidence and initial issue catalogue | **DONE (partial audit)** |
| T1 | Create planning issue + documentation tracker | **DONE** |
| T2 | After explicit owner resume, reconcile `main` and concurrent #594 / #631, then produce full route/role/viewport evidence matrix | **ON HOLD** |
| T3 | Owner-reviewed copy guidelines: Thai-first wording, status policy, expert exceptions, error/accessibility semantics | **ON HOLD** |
| T4 | Public P0 microcopy: system labels, CMS mentions, publication chips, generic authors and stats | **ON HOLD** |
| T5 | Public P1 microcopy: remaining sections, data-sourced copy, empty/loading/error states, accessibility | **ON HOLD** |
| T6 | Routine Admin P1: workflows, form labels, helper texts, navigation, dialogs, settings, editor, org | **ON HOLD** |
| T7 | Technical/Admin P1: backup, recovery, system health, integrations; preserve diagnostic and security context | **ON HOLD** |
| T8 | Regressions: Thai wording tests, semantic/accessibility and sensitive error handling, existing UX/CI checks | **ON HOLD** |
| T9 | Small scoped PRs only when approved; exact-head CI, desktop/mobile UAT and authorized merge/field verification | **ON HOLD** |
| T10 | Owner acceptance, merge/production evidence, explicit tracker closure | **ON HOLD** |

## Definition of done

- Each changed phrase has a documented location, user persona, original wording, approved proposed wording and reason; production/CMS data changes are separately approved.
- Public UI contains no unnecessary implementation terms; dates, useful article metadata and safety/action feedback are intact.
- Operators can complete standard tasks without knowing the underlying technology; expert details remain in controlled views.
- No regression to content publication lifecycle, RBAC/MFA, requests, storage, SEO/SSR, screen-reader behavior, responsive layouts or accessibility.
- Required current-head CI and real deployed browser checks pass, and the owner accepts the outcome.

## Restrictions / dependency boundary

1. **Do not implement anything yet.** This task is intentionally parked while other work remains active.
2. **Do not touch application code, public/admin content, CMS/Worker/D1, dependencies, runtime config, production deployment, issue #594 or #631, or their active branches/PRs.**
3. No implementation PR, merge or production operation has been authorized.
4. This documentation-only branch is intentionally isolated from `main`; do not merge it automatically.
5. Preserve actionable publication statuses in Admin and precise safety/security wording. Hide jargon only when it serves no task-related purpose.
6. A completed concurrent workstream does **not** automatically unblock this one.

## Durable execution state

- **Current work:** planning artefacts only.
- **Baseline SHA at creation:** `326963d82416e818b5e7fa3d0389865737bbfc0c`; refresh at resume.
- **Concurrent work:** Organization Management UX V2.4 [#594](https://github.com/yiwssx/new-www.rcat.ac.th/issues/594), Facebook & Social Links [#631](https://github.com/yiwssx/new-www.rcat.ac.th/issues/631).
- **Branch:** `docs/ux-content-microcopy-cleanup-plan-20261016`.
- **Implementation:** no files, PRs, tests, migrations or deployments.
- **Blocker:** owner explicitly ordered to hold.
- **Exact next action:** await an explicit instruction to resume. On resumption, first re-check GitHub branch/PR/CI and latest public/admin copy, then complete T2 before proposing code edits.
