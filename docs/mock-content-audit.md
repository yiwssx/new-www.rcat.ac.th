# Mock / Static Content Audit

## Current production-readiness summary

The main homepage promotion/data paths are now mostly CMS-backed. `homepageSettings` controls IntroGate, UrgentMarqueeSection, and HomeIntroVideoSection with disabled defaults, so those sections no longer show bundled mock images, marquee text, links, or video URLs. ProcurementNewsSection and JobOpportunitiesSection now render from published CMS `ContentItem` announcement data. PublicHomeCarousel now renders from first-class `carouselSlides`, and admin/editor users can manage those slides in `/admin/carousel`, including selecting images from the Media Library.

The remaining production-readiness risk is concentrated in public UI sections that still render bundled arrays or hard-coded links. The highest-risk public candidates are E-Service cards, achievement highlights, visitor stats, footer directory links, and a default contact map URL fallback. Admin-side examples and placeholders are mostly low risk because they appear inside editing controls rather than as public content.

## Remaining mock/static candidates

| Area                                  | File                                                                                                                                                                                           | Current behavior                                                                                                                           | Risk level | Recommended next phase                                         | Notes                                                                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Public homepage E-Service links       | `src/public/components/home/ExternalServicesSection.tsx`                                                                                                                                       | Renders `mockExternalServiceItems` with visible service names and `https://example.com/...` links.                                         | High       | External Services / E-Service management                       | Public users can click fake destinations. This is the clearest production blocker.                                                              |
| Public homepage visitor stats         | `src/public/components/home/VisitorStatsCard.tsx`                                                                                                                                              | Renders `mockVisitorStats` numbers and an explicit `Mock` chip.                                                                            | High       | Visitor stats real implementation or disable/fallback          | Public-facing statistics appear as fake operational data. Either wire real analytics/counters or hide until configured.                         |
| Public homepage achievements          | `src/public/components/home/AchievementHighlightsSection.tsx`                                                                                                                                  | Renders `mockAchievementItems` award/project/cooperation/personnel cards.                                                                  | High       | Achievement highlights from CMS or settings                    | Public users may interpret achievements as official claims. Should be CMS content or disabled when empty.                                       |
| Footer directory/local links          | `src/public/components/PublicSiteShell.tsx`                                                                                                                                                    | `footerDirectoryGroups` is hard-coded with many `href: "#"` links and example institutional-network labels.                                | High       | Footer/local links management                                  | Public footer exposes non-functional official-looking links. Good candidate for settings or menu-backed groups.                                 |
| Contact map fallback                  | `src/services/siteSettings.ts`, `src/public/components/home/ContactMapCard.tsx`                                                                                                                | `defaultSiteSettings.mapUrl` has a hard-coded Google Maps short URL, so contact card can render a map link even if CMS settings are empty. | High       | Footer/local links management or site settings cleanup         | If the URL is not the real school location, it is wrong official information. Prefer empty default with admin-provided map.                     |
| Floating Messenger button             | `src/public/components/FloatingMessengerButton.tsx`                                                                                                                                            | Messenger URL is hard-coded as `https://m.me/100063746585360`.                                                                             | Medium     | Footer/local links management                                  | Could be valid, but staff cannot update it from CMS settings. Should use `siteSettings` or a link settings module.                              |
| Header search box                     | `src/public/components/PublicSiteShell.tsx`                                                                                                                                                    | Search form prevents default and has no search behavior.                                                                                   | Medium     | Optional homepage/site shell settings or search implementation | Not mock data, but a static control that implies functionality. Hide until implemented or connect to content search.                            |
| Homepage section order                | `src/public/pages/PublicHomePage.tsx`                                                                                                                                                          | Homepage sections are fixed in code.                                                                                                       | Medium     | Optional homepage section ordering/settings                    | Not fake content, but staff cannot disable/reorder static modules like achievements/services/stats without code changes.                        |
| Hero and director fallback copy/icons | `src/public/components/home/HomeHeroSection.tsx`, `src/public/components/home/DirectorHeroCard.tsx`, `src/services/siteSettings.ts`                                                            | Hero/director content is CMS-backed, but neutral fallback titles and an icon placeholder can render when settings are empty.               | Low        | Optional homepage section ordering/settings                    | Acceptable as empty-state behavior, but a production launch should verify real site settings exist.                                             |
| Admin input examples                  | `src/admin/components/ContentBlockBuilder.tsx`, `src/admin/components/ContentEditorDialog.tsx`                                                                                                 | Admin placeholders include example URLs like `https://example.edu/...`.                                                                    | Low        | No immediate phase                                             | These are editor helper placeholders, not public content. They should remain clearly illustrative or be changed to local school examples later. |
| Backend starter seed docs             | `apps-script/README.md`, `apps-script/*`                                                                                                                                                       | Apps Script setup explicitly does not seed sample public content, stats, achievements, or events.                                          | Low        | No cleanup needed                                              | Backend posture is production-friendly; remaining mock content is frontend public UI.                                                           |
| Carousel                              | `src/public/components/PublicHomeCarousel.tsx`, `src/admin/pages/CarouselPage.tsx`, `apps-script/Cms.gs`                                                                                       | Uses `carouselSlides` from CMS snapshot and admin/editor management.                                                                       | Low        | No cleanup needed                                              | Completed. Verify deployed Apps Script includes Carousel sheet/routes.                                                                          |
| IntroGate / Marquee / IntroVideo      | `src/public/components/PublicIntroGate.tsx`, `src/public/components/home/UrgentMarqueeSection.tsx`, `src/public/components/home/HomeIntroVideoSection.tsx`, `src/admin/pages/SettingsPage.tsx` | Controlled by `homepageSettings` with disabled defaults.                                                                                   | Low        | No cleanup needed                                              | Completed. No mock fallback should show by default.                                                                                             |
| Procurement and job sections          | `src/public/components/home/ProcurementNewsSection.tsx`, `src/public/components/home/JobOpportunitiesSection.tsx`, `src/public/pages/PublicHomePage.tsx`                                       | Render published CMS announcements filtered by keywords, with empty states when no matches exist.                                          | Low        | Content category presets follow-up only if needed              | Data path is production-shaped. Admin category presets were added; future work can refine taxonomy.                                             |

## Recommended cleanup phases

1. External Services / E-Service management
   - Objective: Replace `mockExternalServiceItems` with CMS-backed or settings-backed service links, and hide the section when no enabled links exist.
   - Suggested files: `src/public/components/home/ExternalServicesSection.tsx`, `src/public/pages/PublicHomePage.tsx`, `src/types.ts`, `src/services/googleApi.ts`, `src/admin/pages/SettingsPage.tsx` or a new admin page.
   - Backend needed: yes.
   - Admin UI needed: yes.
   - Risk: High.
   - Why this should come next: It contains visible `example.com` links. Public users can click fake destinations, so this is the most direct production blocker.

2. Achievement highlights from CMS or settings
   - Objective: Replace `mockAchievementItems` with real content, a dedicated highlights model, or a disabled empty state.
   - Suggested files: `src/public/components/home/AchievementHighlightsSection.tsx`, `src/public/pages/PublicHomePage.tsx`, `src/types.ts`, `apps-script/Cms.gs`, `src/admin/pages/ContentPage.tsx` or a dedicated admin page.
   - Backend needed: yes if first-class achievements are desired; no if reusing tagged CMS content.
   - Admin UI needed: yes if first-class management is added; no if using content tags only.
   - Risk: High.
   - Why this should not come before E-Service: Fake achievements are serious, but fake external links are more immediately actionable and can send users to wrong sites.

3. Visitor stats real implementation or disable/fallback
   - Objective: Remove public mock visitor numbers by wiring a real counter/analytics source or hiding the card until real values exist.
   - Suggested files: `src/public/components/home/VisitorStatsCard.tsx`, `src/public/pages/PublicHomePage.tsx`, `src/types.ts`, `apps-script/Storage.gs` or a lightweight settings endpoint.
   - Backend needed: maybe. A simple manual settings value could be enough; real traffic counts need a data source.
   - Admin UI needed: maybe, if manual/stat settings are used.
   - Risk: High.
   - Why this should be early: The component explicitly labels itself mock and shows fabricated counts on the public homepage.

4. Footer/local links management
   - Objective: Move `footerDirectoryGroups`, Messenger URL, and default map URL into CMS settings or a link-management resource.
   - Suggested files: `src/public/components/PublicSiteShell.tsx`, `src/public/components/FloatingMessengerButton.tsx`, `src/services/siteSettings.ts`, `src/admin/pages/SettingsPage.tsx`, `apps-script/SiteSettings.gs`.
   - Backend needed: yes for structured footer groups; maybe no for Messenger/map if extended `siteSettings` is enough.
   - Admin UI needed: yes.
   - Risk: High.
   - Why this follows the homepage cards: Footer links are widespread and official-looking, but E-Service/achievement/stat sections are more prominent in the homepage body.

5. Content category presets for procurement/job announcements
   - Objective: Keep improving admin guidance so announcements land in procurement/job homepage sections predictably.
   - Suggested files: `src/admin/components/ContentEditorDialog.tsx`, `src/utils/thaiLabels.ts`.
   - Backend needed: no.
   - Admin UI needed: yes, but this is already mostly handled by the preset chips added earlier.
   - Risk: Low.
   - Why this should not come next: The public sections now show empty states instead of mock cards, and admin guidance already exists. This is refinement, not a production blocker.

6. Optional homepage section ordering/settings
   - Objective: Let admins enable, disable, and possibly reorder homepage modules such as achievements, E-Service, visitor stats, documents, and events.
   - Suggested files: `src/public/pages/PublicHomePage.tsx`, `src/services/homepageSettings.ts`, `src/admin/pages/SettingsPage.tsx`, `src/types.ts`, `apps-script/Storage.gs`.
   - Backend needed: yes.
   - Admin UI needed: yes.
   - Risk: Medium.
   - Why this should come later: It is useful operational control, but removing visible fake content should happen first.

## Immediate next recommendation

Implement **External Services / E-Service management** next. The public homepage still renders visible static service cards with `https://example.com/...` links, which is the clearest risk under the decision rule. This phase should replace the bundled service array with real CMS/settings data and hide the section when there are no enabled links, preserving the current visual style without sending users to fake destinations.

## Non-goals

- Do not remove sections blindly.
- Do not convert everything to backend in one phase.
- Do not add Firebase or new backend technology in this audit.
- Do not modify Apps Script in this phase.
