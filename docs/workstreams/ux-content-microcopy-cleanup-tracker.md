# UX Content & Microcopy Cleanup — Execution Tracker

**Repository:** `yiwssx/new-www.rcat.ac.th`  
**Created:** 2026-10-16 (Asia/Bangkok)  
**Status:** **COMPLETE — MERGED, PRODUCTION VERIFIED; MANUAL OWNER UAT DEFERRED**  
**Tracking issue:** [#634](https://github.com/yiwssx/new-www.rcat.ac.th/issues/634)  
**Implementation baseline:** `main@bfe0c948458f3eb6fdd951eeac7e78cadbc791bb` (2026-10-16, after Social Links closure)  
**Implementation branch:** `fix/ux-public-microcopy-634` (based on latest main); original planning branch: `docs/ux-content-microcopy-cleanup-plan-20261016`  
**Public implementation PR:** [#639](https://github.com/yiwssx/new-www.rcat.ac.th/pull/639) **MERGED** (`3549bab7`).  
**Admin implementation PR:** [#640](https://github.com/yiwssx/new-www.rcat.ac.th/pull/640) **MERGED** (`80f1c8ce`).  
**Production verification:** **PASSED**, `main@3549bab7`, run `38889769389` (Read-only Browser Field QA). Owner-led manual UAT was deferred, not marked passed.

## Final closure record — 2026-10-16 (authoritative; supersedes pending checkpoints)

**Decision:** Owner explicitly accepted the implemented Public/Admin microcopy iteration for closure and will consider further refinements as new work. This is approval to close the _current scoped delivery_, not an assertion that the owner manually completed mobile or authenticated-Admin UAT.

**Merged code and evidence:**

- Admin [PR #640](https://github.com/yiwssx/new-www.rcat.ac.th/pull/640) **MERGED** into `main@80f1c8cef59c18159d26b8e099687419164882f4`. PR CI [#38886724906](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38886724906) SUCCESS, main push CI [#38887527735](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38887527735) SUCCESS, Production Verification [#38888017906](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38888017906) SUCCESS.
- Public [PR #639](https://github.com/yiwssx/new-www.rcat.ac.th/pull/639) **MERGED** into `main@3549bab7caafb98c26871753ac45bbbabdf74151`. PR CI [#38888687535](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38888687535) SUCCESS, Prettier SUCCESS. Latest main push CI [#38889251433](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38889251433) SUCCESS (10/10 required jobs), [Production Verification #38889769389](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38889769389) SUCCESS, **Read-only Browser Field QA job SUCCESS**.
- Vercel exact-SHA Production deployment `dpl_2SE9TvcjnAmq67w44D5a1S59g6Zi` for `3549bab7` is **READY**. This is separate from the two canceled branch Preview attempts (ignored-build policy).
- [Issue #634](https://github.com/yiwssx/new-www.rcat.ac.th/issues/634) **CLOSED (completed)** on 2026-10-16. Separate Organization UX #594 is unaffected.

**Explicitly deferred / not claimed:** User-operated browser acceptance on real phones and authenticated Admin roles, production data editing/restoration tests, and any more expansive wording audit. The protected read-only Production Verification is **not** equivalent to those manual acceptance exercises. Neither the Vercel branch ignored-build policy nor production data was changed by this workstream. These are optional future follow-ups and **do not block the owner's accepted scope closure**.

**Artifact lifecycle:** Close this tracker with this documentation-only PR using repository-required CI; prior paragraphs labelled ACTIVE or PENDING below are historical checkpoints and superseded by this closure record.

## Objective / scope

Simplify technical and internal-facing text across RCAT public pages and routine Admin workflows without changing business behavior or impairing safety, accessibility, operational support, or advanced technical-administrator diagnostics.

**Public coverage:** home, news, announcements, content detail, blog, organization/departments, documents, contact, complaint, calendar, ITA, search, navigation, 404, empty/error/loading, responsive/accessibility text and content coming from CMS.

**Admin coverage:** dashboard, editorial content, media, documents, menus, organization, carousel, E-Service/social, settings, integrations, users/security, backup/restore, system health, confirmations and failures.

**Three audience tiers:** public reader; editorial staff; technical/system administrator. Internal status and jargon should not be exposed to the wrong audience, but technical support and actionable statuses must remain available where needed.

## Preliminary audit evidence (static source, not exhaustive field proof)

| Area                          | Confirmed source evidence                                                                                                    | Intended review                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Public route descriptions     | `src/public/components/PublicSiteShell.tsx`, `src/public/pages/{PublicBlogPage,PublicDepartmentsPage,PublicContactPage}.tsx` | Remove public references to CMS                                                           |
| Public content cards / detail | `src/public/components/PublicContentCard.tsx`, `src/public/pages/PublicContentDetailPage.tsx`                                | Remove redundant publication chips and generic system author metadata when not meaningful |
| Public jobs / procurement     | `src/public/components/home/{JobOpportunitiesSection,ProcurementNewsSection}.tsx`                                            | Remove redundant `เผยแพร่แล้ว` chips                                                      |
| Homepage headlines            | `src/public/components/home/{HomeSectionHeading,ExternalServicesSection}.tsx`                                                | Review `::` and mixed `Online Service Portal` / `E-Service` / Thai titles                 |
| Visitor stats                 | `src/public/components/home/VisitorStatsCard.tsx`                                                                            | Consistent Thai labels for visitor figures / last update                                  |
| Admin workflow guides         | `src/admin/components/*WorkflowGuide.tsx`                                                                                    | Replace `WordPress-like` with task-centric steps                                          |
| Admin settings / editor       | `src/admin/pages/SettingsPage.tsx`, `src/admin/components/ContentEditorDialog.tsx`                                           | Explain Hero/Intro Gate/slug/SEO in operator language; preserve editable functions        |
| Admin organization            | `src/admin/pages/OrganizationPage.tsx`, `src/admin/components/OrganizationUnitContextPreview.tsx`                            | Reduce jargon and implementation-oriented preview explanations                            |
| Admin backups & governance    | `src/admin/pages/BackupPage.tsx`, `src/admin/components/{PortableBackupRecoveryPanel,EditorialWorkflowPanel}.tsx`            | Make recovery/data-loss consequences readable; retain required security warnings          |
| Admin health / integrations   | `src/admin/pages/{SystemHealthPage,IntegrationsPage}.tsx`                                                                    | Surface user-level state first, reserve technical details for expert users                |

**Unverified:** production runtime, authenticated role-specific views, data-driven content and mobile breakpoints require separate later inspection. Two responsive E-Service placements are not confirmed duplication.

## Phase / checkpoint tracker

| ID  | Deliverable                                                                                                                     | State                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| T0  | Preliminary static code evidence and initial issue catalogue                                                                    | **DONE (source audit)**     |
| T1  | Create planning issue + documentation tracker                                                                                   | **DONE**                    |
| T2  | After explicit owner resume, reconcile `main` and concurrent #594 / #631, then produce full route/role/viewport evidence matrix | **DONE (source matrix)**    |
| T3  | Owner-reviewed copy guidelines: Thai-first wording, status policy, expert exceptions, error/accessibility semantics             | **DEFERRED (owner UAT)**    |
| T4  | Public P0 microcopy: system labels, CMS mentions, publication chips, generic authors and stats                                  | **DONE (merged)**           |
| T5  | Public P1 microcopy: remaining sections, data-sourced copy, empty/loading/error states, accessibility                           | **DELIVERED IN SCOPE**      |
| T6  | Routine Admin P1: workflows, form labels, helper texts, navigation, dialogs, settings, editor, org                              | **DONE (merged)**           |
| T7  | Technical/Admin P1: backup, recovery, system health, integrations; preserve diagnostic and security context                     | **DONE (merged)**           |
| T8  | Regressions: Thai wording tests, semantic/accessibility and sensitive error handling, existing UX/CI checks                     | **DONE (CI)**               |
| T9  | Small scoped PRs only when approved; exact-head CI, desktop/mobile UAT and authorized merge/field verification                  | **DONE (release gates)**    |
| T10 | Owner acceptance, merge/production evidence, explicit tracker closure                                                           | **DONE (owner acceptance)** |

## Definition of done

- Each changed phrase has a documented location, user persona, original wording, approved proposed wording and reason; production/CMS data changes are separately approved.
- Public UI contains no unnecessary implementation terms; dates, useful article metadata and safety/action feedback are intact.
- Operators can complete standard tasks without knowing the underlying technology; expert details remain in controlled views.
- No regression to content publication lifecycle, RBAC/MFA, requests, storage, SEO/SSR, screen-reader behavior, responsive layouts or accessibility.
- Required current-head CI and real deployed browser checks pass, and the owner accepts the outcome.

## Resume decision and concurrency

**2026-10-16:** Owner explicitly authorized continuation after rechecking updated `main`. Social Links #631 is CLOSED and accepted with **Facebook header-only**; Organization UX V2.4 #594 is still OPEN and must not be modified as part of public microcopy. Latest baseline at resume `bfe0c948`. Perform small PRs with exact-head gates; do not infer code merge from issue closure. Public source audit updated against latest main; full authenticated Admin/production UX inspection remains pending.

## Restrictions / dependency boundary

1. **Owner authorized implementation of UX microcopy on 2026-10-16.** Start with public P0 copy; keep structural/behavior and unrelated tracks out of scope.
2. **Do not touch application code, public/admin content, CMS/Worker/D1, dependencies, runtime config, production deployment, issue #594 or #631, or their active branches/PRs.**
3. Use a distinct PR for microcopy; merge or production actions only after required exact-head checks and approved operational gates.
4. This implementation branch contains the canonical tracker, copied from the isolated planning branch; do not merge it without green gates.
5. Preserve actionable publication statuses in Admin and precise safety/security wording. Hide jargon only when it serves no task-related purpose.
6. A completed concurrent workstream does **not** automatically unblock this one.

## Durable execution state

- **Current authoritative baseline:** `main@bfe0c948458f3eb6fdd951eeac7e78cadbc791bb`; revalidate before merge.
- **Public PR #639:** implementation checkpoint `fix/ux-public-microcopy-634@c4ce7cfd1aed24eebec0bf9c0aa60c2e4fa5f604`; exact-head [CI #38879501130](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38879501130) **SUCCESS (10/10 jobs)**, plus Prettier and CodeQL **SUCCESS**. This tracker update creates a new head requiring fresh CI before merge.
- **Admin PR #640:** OPEN / READY FOR REVIEW at `fix/ux-admin-microcopy-634@69fa369aec5f4e432faed71aa29098382c6b012c`; exact-head [CI #38879679257](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38879679257) **SUCCESS (10/10 jobs)**, CodeQL **SUCCESS**.
- **Concurrency:** Independent Organization UX #594 remains open for owner Android/portrait/structure UAT; #631 was closed. Both #634 PRs avoid #594's active layout files.
- **Release boundary:** source checks green on recorded heads; real deployed preview and authenticated Admin/mobile owner QA **NOT VERIFIED**, owner signoff **NOT RECORDED**. No production mutation or automatic authenticated write probe.
- **Next:** finish this tracker checkpoint and verify its new PR #639 SHA/checks; move both drafts to review-ready only after accepted checks; seek public desktop/mobile and authenticated Admin field evidence before authorized merge. Do not close #634 prematurely.

## Checkpoint — 2026-10-16 additional PRs and CI

- #639 early CI exposed legacy unit checks tied to removed `Admin` byline, duplicate section headings, and an E2E selector bound to `Website Visitors`. Fixes committed to source and test selectors; latest CI is pending/requeued, **not yet green**.
- #640 independently improves editorial Admin, settings, integration, health and backup/restore copy. Updated targeted unit tests and protected C3 editor locator without executing production C3. Current CI pending; do not assume success.
- No accepted production/browser field UAT for either PR yet. Both remain draft and no merge or deployment authorized at this checkpoint.

## 2026-10-16 source quality and field acceptance matrix

| Surface / role                                | Source changes                                                                   | Automated verification                        | Remaining field UAT                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Public / homepage, 360–430px and desktop      | Thai visitor metrics, section eyebrow, service links and social-widget placement | Unit + responsive Functional E2E PASS on #639 | Mobile layout, authentic visitor figures, social links and link navigation                |
| Public / news, blog, jobs and procurement     | Remove CMS captions, redundant published badges and generic CMS-author names     | Unit + integration + build PASS on #639       | Real CMS articles, legitimate publisher bylines, dates and empty states                   |
| Public / departments and contact              | Plain-language summaries and empty map guidance                                  | Build + Unit PASS on #639                     | Live navigation, department data and Google Maps fallback                                 |
| Admin / editorial, media, documents, menus    | Plain-language forms, tasks, workflow and category permalink                     | Unit + Functional E2E PASS on #640            | Authenticated operator flows with no real writes, accessible names and dialog behavior    |
| Admin / settings, integrations, system health | Human-centered labels and troubleshooting while retaining expert links           | Unit + governance + CodeQL PASS on #640       | Authorized Admin roles, errors, narrow viewport and diagnostics visibility                |
| Admin / portable backup/recovery              | Clear merge-versus-replace and authentication warnings                           | Unit + static/security analysis PASS on #640  | Read-only operator walkthrough; **do not execute restore**                                |
| Release / exact-head approval                 | No protected operations or data changes                                          | CI and CodeQL passed on recorded exact heads  | Production/preview browser evidence, owner acceptance and post-merge verification pending |

**Note:** This is a scoped source/evidence matrix, not a claim that all runtime or role/viewport combinations were tested in production. Original/new copy pairs are visible in each PR's Files Changed diff; the named paths and intended reasons are documented above. The operator may request wording changes before merge.

## Verified exact-head checks and Preview deployment boundary — 2026-10-16

- **Public [#639](https://github.com/yiwssx/new-www.rcat.ac.th/pull/639)**: READY FOR REVIEW; source head `dd722fd4ac163b59d6155c62cd29ef1e9a9371a2`, [CI #38881327183](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38881327183) SUCCESS; 14/14 checks GREEN including CodeQL and Prettier. This tracker documentation commit changes the branch head; re-verify new head checks before merge.
- **Admin [#640](https://github.com/yiwssx/new-www.rcat.ac.th/pull/640)**: READY FOR REVIEW; head `69fa369aec5f4e432faed71aa29098382c6b012c`, [CI #38879679257](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38879679257) SUCCESS; 13/13 checks GREEN including CodeQL.
- **Vercel Preview attempts**: Public `dpl_4Feh7fJqQUaVCgP5WhCwMhmxNovW`, Admin `dpl_8Yis8XZNaA2hAYTqQEtT2u3oRh8z`, pinned to above SHAs, `target=null` (Preview) only. Both CANCELED by `node scripts/vercel-ignore-build.mjs`: `Vercel build ignored: 1 non-runtime path(s) changed.` They are not usable previews.
- **Explained mechanism**: `scripts/vercel-ignore-build.mjs` compares `HEAD^` to `HEAD`; the tip commits are docs/formatting while earlier PR commits modify real `src/` runtime code. Current `vercel.json` also intentionally limits Git auto-deploy branches. These shared deployment policies are **not modified** by #634 without separately approved corrective work.
- **Acceptance**: Source CI green; manual Public desktop/mobile and authenticated Admin UAT NOT VERIFIED. No production changes, no CMS writes, no release and no merge. Keep #634 OPEN; next action is approved Preview/build-gate resolution and read-only field verification, then owner sign-off and protected release.
