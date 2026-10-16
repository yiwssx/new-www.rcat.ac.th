# Homepage Facebook Page + Department/Unit Social Links — Execution Tracker

**Repository:** `yiwssx/new-www.rcat.ac.th`  
**Created:** 2026-10-16 (Asia/Bangkok)  
**Status:** **IMPLEMENTATION ON FEATURE BRANCH — CI/PRODUCTION VERIFICATION PENDING; NOT MERGED**  
**Tracking issue:** [#631](https://github.com/yiwssx/new-www.rcat.ac.th/issues/631)  
**Planning branch:** `docs/homepage-facebook-social-links-plan-20261016`  
**Implementation branch:** `feature/homepage-facebook-social-links`  
**Implementation PR:** [#633](https://github.com/yiwssx/new-www.rcat.ac.th/pull/633) (draft; CI still being fixed)  
**Reference:** owner-supplied screenshot showing college Facebook plugin followed by department social links; used as a structural reference, not copied as artwork or live production data.

## 1. Requirements and scope

Add a controlled and responsive **Facebook & Social Links** homepage block.

1. Embed the college **Facebook Page / Timeline** (not a single post) with width fitted to its parent card, bounded configurable height, and graceful loading/error/link fallback.
2. Underneath, display **links to Facebook Pages of departments and administrative units**. Admin can enter a display label, HTTPS URL, select an icon, toggle visibility and reorder links. Group by `department` and `unit` for meaningful headings; avoid hardcoded organization names.
3. **Desktop (`lg+`)**: show block **immediately under the existing visitor statistics** in the right column of the public homepage.
4. **Mobile (`xs`)**: show block as the **last content block of the public homepage before footer**, not as a floating overlay; keep the whole widget in normal document flow.
5. Add a dedicated Admin Settings section: **`/admin/settings/social` — Facebook และลิงก์หน่วยงาน** via existing settings submenu. Admin should edit, preview, save and reload this section without visiting a long SPA.
6. Preserve the existing visitor statistics, footer directory, Messenger, homepage sections, existing social button behavior, responsive order and public accessibility.

### Observed implementation baseline

| Area                      | Verified source                                                                                                                            | Finding                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home layout               | `src/public/pages/PublicHomePage.tsx`                                                                                                      | Homepage is a responsive left/right MUI Grid; right-side Stack ends in `LiveVisitorStatsCard`. On mobile the right column follows the left, so adding the panel **after** the stats gives both requested placements without duplicate render/iframe. |
| Settings submenu          | `src/config/adminSettingsCategories.ts`, `src/admin/pages/settings/settingsSections.ts`, `src/admin/layout/CmsShell.tsx`, `src/routes.tsx` | Dedicated routes for settings categories already exist under `settings.read`. Extend this pattern instead of creating a parallel Settings SPA.                                                                                                       |
| Data model                | `src/features/cms-settings/types.ts`, `src/services/siteSettings.ts`                                                                       | `SiteSettings.facebookUrl` already exists; footer directory groups also exist but serve a different public placement and have no icon model.                                                                                                         |
| Save conflict handling    | `settingsSections.ts` / prior [Admin Settings tracker](admin-settings-leadership-ux-tracker.md)                                            | Existing scoped site-settings updates guard unrelated edits. Extend category key ownership without clobbering other categories.                                                                                                                      |
| Current Facebook support  | `src/utils/facebookEmbed.ts`, `src/shared/media/ResponsiveFacebookPluginEmbed.tsx`                                                         | Existing iframe utility embeds Facebook **posts**, not whole Page timelines. Implement Page plugin support as a separate utility/component, reusing established safe/deferred media patterns where applicable.                                       |
| Persistence / public data | Existing Worker site settings and public shell metadata adapters                                                                           | Confirm the nested field validation and projection; plan additive compatibility rather than assuming a frontend-only change reaches production.                                                                                                      |

## 2. Admin IA and editor UX

Proposed Settings submenu item: **Facebook และลิงก์หน่วยงาน** with its own directly navigable route `/admin/settings/social`.

**Facebook Page block:**

- Enable/disable the embed.
- Canonical school Facebook Page URL (use the existing `siteSettings.facebookUrl` field where possible; do not introduce a conflicting second school-page URL).
- Display heading; bounded adjustable height (candidate default 520px, revise after real Page plugin QA); live preview at desktop and mobile widths.
- Browser fallback: display a normal **เปิดเพจ Facebook วิทยาลัย** hyperlink if the plugin cannot load, is blocked or URL is unset. Hidden/empty blocks must not leave a tall blank region.

**Social directory editor:**

- Add/edit/delete links, label, link URL, category (แผนกวิชา / งานหรือหน่วยงาน), icon picker, visible toggle and order within a category.
- Accessible reorder actions (up/down; drag and drop not required), concise URL errors, copy-friendly URL input and unsaved-change handling.
- Public displays only enabled, valid records; empty categories hide; all entries are data-driven.
- Icon model: stable string enum from a reviewed icon registry, **plus owner-approved custom PNG/JPG/WebP uploads (max 2 MB) through the existing Drive media bridge**.
- Existing footer directory link editor stays independent. No automatic copying, no duplicate public rendering.

## 3. Proposed data contract (subject to implementation review)

Prefer a backward-compatible optional nested SiteSettings field, e.g.:

```ts
interface HomepageSocialLink {
  id: string;
  category: "department" | "unit";
  label: string;
  href: string;
  icon: string; // stable allowlisted ID; image upload is pending confirmation
  enabled: boolean;
  sortOrder: number;
}
interface HomepageSocialSettings {
  enabled: boolean;
  pageEmbedEnabled: boolean;
  pageEmbedHeight: number;
  links: HomepageSocialLink[];
}
interface SiteSettings {
  // Existing canonical Facebook Page address stays here:
  facebookUrl: string;
  homepageSocial?: HomepageSocialSettings;
}
```

Contract is a **proposal, not committed runtime code**. Default is disabled/empty so existing production data remains unchanged, and malformed items fail closed. Bind `facebookUrl` to one canonical editor owner (the new Social page) or document a deliberate read-only link in General. If the field changes category, preserve old values and all public uses. Validate nested types, count/text limits, valid `https` links and supported icon keys on both client and Worker. Persist through existing site settings JSON using scoped PATCH. Verify public metadata projection includes the new field.

## 4. Responsive / embed and safety contract

- One component instance after `LiveVisitorStatsCard` inside the right-side Stack. On `lg+` it remains below stats; at `xs` it becomes last homepage content before `PublicSiteShell`'s footer directory/footer. Test actual `md`/`lg` breakpoint behavior.
- Facebook Page plugin is a third-party iframe and may be blocked by consent settings, tracking protection or Facebook. Use Facebook-provided embed endpoint and host allowlist; no arbitrary HTML or pasted iframe execution from CMS.
- Dynamically measure the parent width and constrain to Page plugin limits. Do not copy the post-embed width implementation without checking differences. Avoid horizontal scrolling, huge whitespace, clipping, cumulative layout shift and duplicate iframe downloads.
- Lazy/deferred load below the fold; accessible title and link; visible fallback that does not falsely claim posts have loaded. Avoid third-party requests until it is needed/allowed under the site's privacy policy.
- External links: `https` URL checking; Facebook page embed requires exact allowed Facebook hosts; anchors use `target="_blank"` only with `rel="noopener noreferrer"`. Never render raw SVG/HTML/scripts from admin input.
- Reuse React/MUI/available icon components; **no new dependency expected**. If an icon picker package is proposed, first justify bundle/performance/security impact and request approval.

## 5. Phase gates / actionable checklist

| Phase | Deliverable                                                                                            | Acceptance / evidence                                                                                                                         | Status |
| ----- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| P0    | Scope, reference review, inspect SiteSettings / Worker, confirm icon interpretation and real Page link | Owner confirms outstanding icon choice; record design decision                                                                                | [ ]    |
| P1    | New Settings category, route, editor, picker, preview, partial save                                    | Add/edit/reorder/delete, enable/disable, reload, permissions, conflict safety                                                                 | [ ]    |
| P2    | Optional settings contract, normalization, Worker validation and public projection                     | Backward compatibility, API read/write tests, safe defaults, no implicit production data migration                                            | [ ]    |
| P3    | Responsive Page plugin and linked social directory                                                     | Desktop below visitor stats; mobile last before footer; proper URL/embed/error/no-data states                                                 | [ ]    |
| P4    | Quality + security verification                                                                        | Unit, integration, Functional E2E, accessibility, 390px/mobile and desktop visual checks; no regressions, all required exact-head CI green    | [ ]    |
| P5    | Approved merge and production release / verification                                                   | PR merged only after required checks; Worker/frontend deployment order attested; operator validates live page and explicitly approves closure | [ ]    |

### Functional acceptance matrix

- Desktop: existing statistics card remains intact; Facebook widget and all published link groups are immediately below it.
- Mobile (360px, 390px, 430px): widget appears once at bottom of homepage content immediately before footer directory/footer, no horizontal overflow.
- A Facebook Page URL displays the **Page**, never mistaken for a single post or reel; disabled/blocked private content has a useful link fallback.
- Admin can add 0..N links without hard-coded unit names; every link has the correct saved label, icon, group, URL, visibility and order after reload.
- Invalid/unsafe URLs and unsupported icons are rejected or hidden; no injected code.
- Save one settings category, then modify another; changes cannot silently overwrite each other. RBAC read-only users cannot modify content.
- Static Quality / Prettier, TypeScript/build, targeted unit + integration + E2E, Worker security checks (if changed) and final exact-commit CI pass. CI pass is **not** a claim of live production UAT.

## 6. Release boundaries and operator decisions

- The operator approved both prebuilt icon selection and custom logo upload on 2026-10-16. Implementation is now on feature PR #633. **Do not merge runtime changes, deploy Worker, seed links, or close #631 before complete green verification and deployment acceptance.**
- Do not infer real Facebook links from the reference screenshot. The owner/admin will supply the school's current Page URL and unit links in CMS, or the canonical `siteSettings.facebookUrl` will be used if verified.
- Keep active UI/UX, organization and dependency workstreams out of scope. Do not change workflows, dependencies, visitor counters, legacy footer directory behavior or shared component contracts without explicit regression verification.
- Update a checkbox only with verifiable evidence, linked PR/commit/CI and any manual acceptance notes; record deferred production checks as unverified.

## 7. Implementation verification ledger — 2026-10-16

- **Operator decision:** both icon library and custom uploaded logos are required; completed P0 scope confirmation.
- **PR:** [#633](https://github.com/yiwssx/new-www.rcat.ac.th/pull/633) (draft). Code provided: `src/features/cms-settings/socialWidget.ts`, `src/admin/pages/settings/SocialSettingsEditor.tsx`, `src/public/components/home/HomeSocialLinksCard.tsx`, `src/shared/components/SocialLinkIcon.tsx`, existing Settings site normalization/navigation, Worker URL validation/public contract, and tests.
- **No new package:** existing React, MUI, and Media Bridge reused.
- **Initial CI run** [#38841831203](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38841831203): Dependency Preflight, Dependencies, Integration, and Worker reported success. Static Quality initially failed Prettier (8 changed files), and Build/Governance initially failed due missing MUI icon import names and invalid MUI v9 props. **Initial CI is not green.** The import/props defects were corrected in subsequent commits; exact-head CI remains required.
- **P1–P3 status:** implementation proposed on PR #633, *not accepted/checked off*. Do not misrepresent draft code as production-verified.
- **Outstanding:** actual upload persistence, saved page URL, 360/390/430px and desktop screenshots, public Meta Page plugin appearance, accessibility, and real Worker/frontend deployment are not yet attested. Work continues until CI green before requesting operator production UAT.
