# Admin Settings Navigation + Homepage Leadership Rotation — UI/UX Execution Tracker

**Repository:** `yiwssx/new-www.rcat.ac.th`  
**Created:** 2026-10-14 (Asia/Bangkok)  
**Baseline inspected:** `main` at `3e51accb46f5025be03f7826112a43c0afa8d873`  
**Status:** **BOTH ISSUES CLOSED BY OPERATOR — CODE AND CI VERIFIED; PRODUCTION FIELD QA / WORKER RELEASE NOT ATTESTED**  
**Planning branch:** `docs/admin-settings-leadership-ux-plan-20261014`  
**Planning PR:** [#601 — docs(ui-ux): track admin settings split and executive rotation](https://github.com/yiwssx/new-www.rcat.ac.th/pull/601)  
**Tracker reconciliation PR:** [#604](https://github.com/yiwssx/new-www.rcat.ac.th/pull/604)  
**Implementation issues:** [#599 — Settings navigation](https://github.com/yiwssx/new-www.rcat.ac.th/issues/599) and [#600 — Leadership rotation](https://github.com/yiwssx/new-www.rcat.ac.th/issues/600)  
**Unrelated active work:** Organization Management/Chart UX issues remain independent and must not be marked complete by this tracker.

## 1. Goal and release boundary

The operator requested a fresh UI/UX workstream with two separate tasks:

1. Break the long, hard-to-navigate Admin Settings single-page experience into real, direct-linkable settings pages with a collapsible submenu.
2. On the **public homepage only**, rotate executive photo and details in this strict order: **Director → Deputy 1 → Deputy 2 → Deputy 3 → Deputy 4 → Director → repeat indefinitely**.

**Historical planning checkpoint:** PR #601 covered documentation only. Later implementation PRs #602 and #603 were separately CI-validated and merged; both Issues were operator-closed on 2026-10-15.

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

- [x] **A1 Discovery:** inventory, field-to-route grouping, current records, guards and tests delivered in PR #602.
- [x] **A2 Route/UI shell:** seven nested protected routes, overview and collapsible Settings submenu merged in PR #602.
- [x] **A3 Component extraction:** category-scoped rendering and conditional queries delivered. Shared `SettingsPage.tsx` source remains and was **not** decomposed into seven separate modules.
- [x] **A4 Data safety:** scoped partial writes, existing RBAC and same-field conflict warnings covered by regression tests; conflict checks are not atomic CAS.
- [x] **A5 Quality:** automated navigation, integration, unit and existing functional E2E/quality checks green in CI #38583569747; live production/mobile UAT not attested.
- [x] **A6 Release gate:** exact-head CI green, PR #602 merged, and owner-authorized closure recorded; live production verification explicitly waived for issue closure.

**Acceptance:** an editor can open any settings category directly, understand their current category without scrolling a monolithic page, edit/save only permitted fields, reload without losing state, and not accidentally overwrite another category's edits.

### Implementation checkpoint — 2026-10-14, PR #602

- Feature branch: `feature/admin-settings-route-refactor`; [PR #602](https://github.com/yiwssx/new-www.rcat.ac.th/pull/602).
- Added separate Settings overview and seven `settings/<category>` routes under the existing `settings.read` guard; updated the collapsible submenu without touching Organization navigation.
- Split the **rendered** Settings form and data queries by category; no longer show the long combined form on any settings route. Shared Settings form logic remains in `SettingsPage.tsx`; further file/module extraction can be independently evaluated after behavior is verified.
- Site saves now calculate changed keys for the active category and PUT **only those keys**, using existing Worker partial merge semantics. Changes to the same key since initial load are rejected with a reload message. This is best-effort client-side conflict detection, not atomic compare-and-swap.
- Initial direct-link/access controls and cross-section overwrite regression added; running full CI and operator verification is still required.
- Scope guard: no Worker/D1 schema changes, dependency or workflow changes, Organization Chart edits or Homepage Leadership Rotation implementation.
- Worker audit: `adminStructuredParity.ts` merges partial site-settings PUTs with the current record.

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

### Implementation checkpoint — 2026-10-15, Workstream B #600

- Branch: `feature/homepage-leadership-rotation`; implementation PR [#603](https://github.com/yiwssx/new-www.rcat.ac.th/pull/603).
- No new packages or pnpm lockfile changes; React + MUI hooks and existing `PublicResponsiveImage` are sufficient.
- Preserve legacy `directorName/directorTitle/directorDescription/directorImageUrl` as the single canonical Director slot. Add optional `siteSettings.leadership` containing four fixed ordered deputy slots (`enabled/name/title/description/imageUrl`) and a 6-second default interval (range 3–30).
- No schema migration: existing D1 `site_settings.settings_json` persists the new optional field via current deep-merge PUT, and the public metadata adapter forwards it through existing public snapshots. Add an optional public contract and nested Worker URL validation; do not write real D1 personnel data.
- Editor lives in existing `/admin/settings/leadership` route, uses `settings.manage` permission enforcement and the #602 changed-keys-only save guard. Draft URL input is preserved while typing; normalized URL is persisted upon save.
- Public-only widget cycles Director > enabled deputy 1–4 > Director indefinitely, skips missing entries, keeps single Director static, supports manual arrows/keyboard and pauses on hover/focus, inactive tab or reduced-motion preference. Each transition updates portrait and text together.
- **Release note:** Worker validation must be deployed by the operator after main merge. Worker contract is additive; old Worker deep-merge preserves the new key in the meantime. Production UAT must verify the saved roster reloads via both Admin GET and Public Shell/Home GET and the image URLs resolve.
- Tests: model ordering/missing entries, CMS editor read-only and draft state, timed component cycle, Worker nested URL policy.
- [PR #603](https://github.com/yiwssx/new-www.rcat.ac.th/pull/603) was squash-merged into `main` at `01964eed963c79004e87566b04f9294bfcb28c82`.
- [CI #38608145217](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38608145217) on exact head `a59e912621889ff021fd4aec640a7a606b89e24f`: all checks and aggregate `quality` succeeded, including Unit, Integration and Functional E2E.
- No Worker deploy or production D1 writes were performed. The owner directed closure of #600 on 2026-10-15; the protected Worker release and production field QA remain unverified.

### Data / administration design gate

Existing `SiteSettings` contains only `directorName`, `directorTitle`, `directorDescription`, `directorImageUrl`. Before implementation, document a safe **ordered five-slot model** and normalization/default behavior, and decide whether it extends existing site settings or uses a separate homepage leadership record. Explicitly examine both Worker validation and public snapshot projection before changing contract shape. Migration must preserve existing director values; it must not require immediate production D1 edits.

The new editor belongs under **Settings → Leadership**, with five clearly labeled slots, image preview, input validation, status/empty-state behavior and save/reload. Reuse secure CMS APIs and RBAC; do not silently introduce a second conflicting source of truth from the Organization module.

### Workstream B execution checklist

- [x] **B1 Data design:** implemented legacy-compatible ordered leadership model, optional site-settings JSON, public projection, nested Worker validation and documented release order.
- [x] **B2 Admin editor:** five-slot Leadership editor with portrait preview, URL handling, edit permissions and drafts delivered in PR #603.
- [x] **B3 Public component:** homepage-only timed sequence with skipping incomplete deputies, synchronized record changes and director-only static fallback implemented.
- [x] **B4 Accessibility/performance:** manual controls, reduced motion, tab visibility and responsive portrait behavior implemented; production media failure QA not attested.
- [x] **B5 Tests:** unit/component and Worker validation tests added; existing repository browser E2E and aggregate CI #38608145217 green, with no new production/mobile browser E2E attested.
- [x] **B6 Release gate:** PR #603 exact-head CI green and merged; operator closed #600 without claiming Worker release or production field QA succeeded.

**Acceptance:** with all five entries configured, the user sees the specified sequence indefinitely and each slide's image, name, title and description match; with only director configured, the previous behavior still works; settings can be managed without manipulating a giant SPA.

### Closure and verification exception — 2026-10-15

Issues [#599](https://github.com/yiwssx/new-www.rcat.ac.th/issues/599) and [#600](https://github.com/yiwssx/new-www.rcat.ac.th/issues/600) were **closed on the owner's explicit instruction**, not because every originally proposed manual production acceptance step had passed. The checkboxes above certify the **delivered implementation / automated CI / operator's closure decision** as described in their revised wording. They do not certify unperformed activities.

- **Settings #599:** real desktop/mobile admin route, save/reload, and simultaneous-edit production checks not attested; extracting each page into a separate source module remains outside implemented scope.
- **Leadership #600:** Cloudflare Worker production release and approval, real five-person data entry, saved public snapshots and mobile/media field QA not attested; dedicated production/mobile E2E not claimed.
- Further defects or additional scope will be handled as separate owner-directed work; the two Issues remain closed.

## 5. Overall plan and order

| Step | Deliverable                                                                                                    | Depends on                        | State                                |
| ---- | -------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------ |
| P0   | Create #599 and #600; commit this tracking plan to `main` through a documentation-only PR                      | Latest `main`                     | Planning PR #601 merged              |
| P1   | Implement A1–A4 on `feature/admin-settings-route-refactor`                                                     | P0                                | PR #602 merged; CI green             |
| P2   | Verify A5–A6 and release Settings navigation without changing homepage behavior                                | P1                                | Code merged; operator UAT pending    |
| P3   | Implement B1–B3 on `feature/homepage-leadership-rotation`                                                      | P2; stable Leadership admin route | PR #603 merged; CI green             |
| P4   | Verify B4–B6, compatible release order and operator review                                                     | P3                                | QA green; Worker release/UAT pending |
| P5   | Update issues and tracker with exact PRs, hashes, CI evidence, production verification and operator acceptance | Each release                      | Issue #600 updated; UAT outstanding  |

**Historical implementation scope rule:** each workstream used a separate feature branch/PR and passed exact-head CI. The operator chose to close both implementation Issues without asserting protected Worker release or hands-on production validation.

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
4. Historical rule superseded by the 2026-10-15 owner instruction: #599 and #600 were closed after merged code and exact-head CI. No Worker deploy or production field QA success is implied.
5. If a prior Organization UX tracker/PR is active, leave its scope and workflow untouched.
