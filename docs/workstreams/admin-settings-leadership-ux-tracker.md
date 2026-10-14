# Admin Settings Navigation + Homepage Leadership Rotation — UI/UX Execution Tracker

**Repository:** `yiwssx/new-www.rcat.ac.th`  
**Created:** 2026-10-14 (Asia/Bangkok)  
**Baseline inspected:** `main` at `3e51accb46f5025be03f7826112a43c0afa8d873`  
**Status:** **ACTIVE — SETTINGS CODE PR #602; CI AND PRODUCTION UAT NOT YET ACCEPTED; LEADERSHIP ROTATION NOT STARTED**  
**Planning branch:** `docs/admin-settings-leadership-ux-plan-20261014`  
**Planning PR:** [#601 — docs(ui-ux): track admin settings split and executive rotation](https://github.com/yiwssx/new-www.rcat.ac.th/pull/601)  
**Implementation issues:** [#599 — Settings navigation](https://github.com/yiwssx/new-www.rcat.ac.th/issues/599) and [#600 — Leadership rotation](https://github.com/yiwssx/new-www.rcat.ac.th/issues/600)  
**Unrelated active work:** Organization Management/Chart UX issues remain independent and must not be marked complete by this tracker.

## 1. Goal and release boundary

The operator requested a fresh UI/UX workstream with two separate tasks:

1. Break the long, hard-to-navigate Admin Settings single-page experience into real, direct-linkable settings pages with a collapsible submenu.
2. On the **public homepage only**, rotate executive photo and details in this strict order: **Director → Deputy 1 → Deputy 2 → Deputy 3 → Deputy 4 → Director → repeat indefinitely**.

**Approval at this stage covers planning/issue/tracker publication into `main` only.** No feature code should be merged as part of this planning PR. Separate implementation PRs must pass the normal quality/release gates before they can be merged and deployed.

## 2. Verified code baseline and findings

| Current area            | Source                                                                                              | Finding                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Settings monolith       | `src/admin/pages/SettingsPage.tsx`                                                                  | ~1,652 lines covering display/date, public site, homepage, visitor stats, role overview and security; several save actions |
| Admin routing           | `src/routes.tsx`                                                                                    | Single guarded `/admin/settings` route using `settings.read`                                                               |
| Admin navigation        | `src/admin/layout/CmsShell.tsx`                                                                     | Single Settings navigation item                                                                                            |
| Settings data contracts | `src/features/cms-settings/types.ts` and `src/features/cms-settings/api.ts`                         | Site, homepage and display have existing typed contracts and API calls                                                     |
| Public leadership       | `src/public/components/home/DirectorHeroCard.tsx`, `src/public/components/home/HomeHeroSection.tsx` | Current card reads one director from `SiteSettings` and appears on the homepage                                            |
| Home loading            | `src/public/pages/PublicHomePage.tsx`                                                               | Home already normalizes site and homepage settings from its public snapshot                                                |

**Architecture risk:** splitting a single site-settings object across multiple pages can overwrite changes made elsewhere if each page saves a stale whole-object snapshot. The implementation must prove conflict-safe persistence, not merely split the visual sections.

## 3. Workstream A — Admin Settings Navigation Refactor (issue #599)

### Information architecture (proposed direct routes)

- `/admin/settings` — short index/redirect with preserved existing links and bookmarks.
- `/admin/settings/general` — institution/site identity, contact/social, maps and site Hero.
- `/admin/settings/homepage` — current Intro Gate, marquee and introductory video.
- `/admin/settings/leadership` — executive settings; host for Workstream B editor.
- `/admin/settings/footer` — footer directory, labels and Messenger controls.
- `/admin/settings/appearance` — date/time display, ribbon and mourning presentation.
- `/admin/settings/visitors` — visitor metrics and enable/disable controls.
- `/admin/settings/access` — role overview and security links. Do not duplicate `/admin/users` or the existing account security UI.

Routes must be actual route-level pages, not tabs that mount the full 1,652-line settings page. Menus should expand/collapse in desktop and mobile layouts, expose active location and support keyboard navigation. Preserve `settings.read` and the current per-action edit restrictions. Verify whether each category needs additional capability checks before creating routes.

### Workstream A execution checklist

- [ ] **A1 Discovery:** create a field-to-route and save-handler inventory; map legacy links, API record ownership, read-only roles and existing settings test coverage.
- [ ] **A2 Route/UI shell:** add nested protected routes; replace the single menu entry with collapsible Settings submenu; keep `/admin/settings` deep links valid.
- [ ] **A3 Component extraction:** split each form into scoped components/hooks; lazily fetch only its required settings record(s); keep loading/error/empty states distinct.
- [ ] **A4 Data safety:** preserve validation, save confirmation and RBAC; prevent cross-subpage stale whole-record writes; test two-tab and cross-subpage conflict cases.
- [ ] **A5 Quality:** navigation, responsive layout, keyboard/ARIA and mobile touch, save/reload, capability permissions, legacy route redirects, visual/functional regression and query footprint.
- [ ] **A6 Release gate:** exact-head formatting/lint/type/test/build/E2E/security/governance checks green; review, merge and verify only after authorization and documented acceptance.

**Acceptance:** an editor can open any settings category directly, understand their current category without scrolling a monolithic page, edit/save only permitted fields, reload without losing state, and not accidentally overwrite another category's edits.

### Implementation checkpoint — 2026-10-14, PR #602

- Feature branch: `feature/admin-settings-route-refactor`; [PR #602](https://github.com/yiwssx/new-www.rcat.ac.th/pull/602).
- Added separate Settings overview and seven `settings/<category>` routes under the existing `settings.read` guard; updated the collapsible submenu without touching Organization navigation.
- Split the **rendered** Settings form and data queries by category; no longer show the long combined form on any settings route. Shared Settings form logic remains in `SettingsPage.tsx`; further file/module extraction can be independently evaluated after behavior is verified.
- Site saves now calculate changed keys for the active category and PUT **only those keys**, using existing Worker partial merge semantics. Changes to the same key since initial load are rejected with a reload message. This is best-effort client-side conflict detection, not atomic compare-and-swap.
- Initial direct-link/access controls and cross-section overwrite regression added; running full CI and operator verification is still required.
- Scope guard: no Worker/D1 schema changes, dependency or workflow changes, Organization Chart edits or Homepage Leadership Rotation implementation.

## 4. Workstream B — Homepage Executive Portrait Rotation (issue #600)

### Functional contract

- Only the existing leadership card area of the **public homepage** rotates. Never animate leadership views on Organization pages or other public routes.
- Fixed sequence: **Director (slot 0), Deputy 1 (slot 1), Deputy 2 (slot 2), Deputy 3 (slot 3), Deputy 4 (slot 4), then back to slot 0**.
- Change image, name, position/title and optional description together as one record; no mismatched person/text during transitions.
- Suggested initial autoplay interval: **6 seconds**; make it configurable through CMS if appropriate. Do not share controls or settings inadvertently with the existing homepage image carousel.
- Use a stable **3:4 portrait aspect ratio**, responsive sizing and preloading of the next valid photo to avoid layout shifts.
- Provide previous/next controls, meaningful labels, keyboard accessibility, pause on hover/focus, document visibility handling and `prefers-reduced-motion` behavior. Timers must clean up.
- Configured five positions should always use the specified rank/order. If an entry has no usable required data, skip it without substituting fictional content; one valid entry should remain static. Preserve current director rendering as a backward-compatible fallback.
- No hard-coded names/photos; photos should use existing validated public-media handling, safe URLs, descriptive alt text and reasonable dimensions.
- Do not import/overwrite live organization personnel in this workstream. Future optional linking to canonical personnel IDs requires separate schema/permissions review, especially while Organization UX work remains active.

### Data / administration design gate

Existing `SiteSettings` contains only `directorName`, `directorTitle`, `directorDescription`, `directorImageUrl`. Before implementation, document a safe **ordered five-slot model** and normalization/default behavior, and decide whether it extends existing site settings or uses a separate homepage leadership record. Explicitly examine both Worker validation and public snapshot projection before changing contract shape. Migration must preserve existing director values; it must not require immediate production D1 edits.

The new editor belongs under **Settings → Leadership**, with five clearly labeled slots, image preview, input validation, status/empty-state behavior and save/reload. Reuse secure CMS APIs and RBAC; do not silently introduce a second conflicting source of truth from the Organization module.

### Workstream B execution checklist

- [ ] **B1 Data design:** settle type/schema/normalization, legacy compatibility, storage/projection and Worker release sequencing.
- [ ] **B2 Admin editor:** create the five-position editor under Settings → Leadership; validate photo URL, labels and accessible preview; keep drafts safe.
- [ ] **B3 Public component:** implement precise 0→1→2→3→4→0 loop, fallback/empty behavior and synchronized media+text transitions.
- [ ] **B4 Accessibility/performance:** manual controls, reduced motion, visible/hidden tab behavior, responsive 3:4 portraits, image failures and no content layout shift.
- [ ] **B5 Tests:** unit boundary/wraparound/missing slots, frontend component, RBAC/API compatibility and browser E2E on desktop/mobile; confirm no rotation on other routes.
- [ ] **B6 Release gate:** exact-head quality green, compatible frontend/Worker release order if applicable, approval, controlled operator validation and then closure.

**Acceptance:** with all five entries configured, the user sees the specified sequence indefinitely and each slide's image, name, title and description match; with only director configured, the previous behavior still works; settings can be managed without manipulating a giant SPA.

## 5. Overall plan and order

| Step | Deliverable                                                                                                    | Depends on                        | State                                             |
| ---- | -------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------- |
| P0   | Create #599 and #600; commit this tracking plan to `main` through a documentation-only PR                      | Latest `main`                     | **In progress until planning PR actually merged** |
| P1   | Implement A1–A4 on `feature/admin-settings-route-refactor`                                                     | P0                                | Implemented in PR #602; pending acceptance        |
| P2   | Verify A5–A6 and release Settings navigation without changing homepage behavior                                | P1                                | CI/UAT pending                                    |
| P3   | Implement B1–B3 on `feature/homepage-leadership-rotation`                                                      | P2; stable Leadership admin route | Not started                                       |
| P4   | Verify B4–B6, compatible release order and operator review                                                     | P3                                | Not started                                       |
| P5   | Update issues and tracker with exact PRs, hashes, CI evidence, production verification and operator acceptance | Each release                      | Not started                                       |

**Scope rule:** use one implementation branch + one PR for each workstream. Do not mix A/B implementation into the planning PR. Feature work should not be marked complete before CI, protected release (if required) and hands-on operator validation.

## 6. Quality, security and regression checks

- Existing authentication, `settings.read` and write restrictions, CSRF, audit semantics, API paths and production settings values stay authoritative.
- Preserve the historical `/admin/settings` route and account/users routes.
- Verify site settings save conflict behavior across two routes/tabs before shipping.
- Desktop/mobile widths (including 390px), reduced-motion and keyboard/screen reader operation.
- Unit, integration, Playwright/E2E, dependency preflight, Static Quality/Prettier, TypeScript/build, Worker (if modified), governance and final `quality` check against the latest PR head.
- Avoid production D1 writes, test-personnel insertion, workflow edits, unchecked dependency additions, forced status checks or direct protected release.
- CI green is not equivalent to production verification. If the leadership schema requires Worker updates, document and follow a safe compatible Worker/frontend sequence rather than assuming the frontend alone updates the backend.

## 7. Operating rules / handoff

1. Planning-only PR may merge to `main` after required checks and approvals; it authorizes **no runtime UI behavior change**.
2. Before each implementation phase, compare current `origin/main` with the recorded baseline; do not develop against a stale branch.
3. Update the applicable issue and this tracker with a checkbox only after concrete test and acceptance evidence exists.
4. Do not close #599 before admin routing is released and operator verified; do not close #600 before the homepage rotation and editor are verified.
5. If a prior Organization UX tracker/PR is active, leave its scope and workflow untouched.
