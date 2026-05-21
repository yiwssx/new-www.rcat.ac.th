# Mock / Static Content Audit

## Current production-readiness summary

The public homepage is now substantially safer than the previous audit. The main public-facing mock risks have been moved behind CMS data, disabled defaults, or admin-managed settings:

- `homepageSettings` controls IntroGate, UrgentMarqueeSection, and HomeIntroVideoSection with disabled defaults.
- Carousel is a first-class module backed by `carouselSlides`, with admin/editor management and media picker support.
- E-Service links are first-class `externalServices` records and the public section hides when no enabled links exist.
- VisitorStats is automatically counted from privacy-friendly public site views, hidden unless enabled, and no longer shows a public Mock chip.
- AchievementHighlights renders from published CMS `ContentItem` data and hides when no matching content exists.
- Footer directory links are stored in `siteSettings.footerDirectoryGroups` and public rendering filters disabled, empty, and `#` links.
- Floating Messenger is controlled by `siteSettings.messengerUrl`, `messengerLabel`, and `messengerEnabled`.
- Search is implemented as `/search` using published public snapshot content.
- Map/Contact no longer seeds a hard-coded Google Maps default URL; the old unsafe map URL is treated as a legacy value and normalized to empty.
- ProcurementNewsSection and JobOpportunitiesSection render from published CMS announcement content filtered by title, summary, category, and tags.

No current public component scan found the old public mock arrays for E-Service, visitor stats, achievements, carousel slides, intro gate, marquee, intro video, procurement, or job listings. The remaining items are mostly governance, launch data-entry, and admin helper placeholders rather than public fake content.

## Remaining mock/static candidates

| Area                                    | File                                                                                                                                                                                 | Current behavior                                                                                                                                                       | Risk level: High / Medium / Low | Recommended action                                | Notes                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Starter site identity                   | `src/services/siteSettings.ts`, `apps-script/SiteSettings.gs`                                                                                                                        | Empty settings normalize to neutral labels such as `เว็บไซต์สถานศึกษา`; Apps Script starter seed also uses neutral site title/footer title.                            | Medium                          | Launch data-entry checklist                       | This is not fake factual data, but a launch can look unfinished if real site identity is not entered. Verify before production. |
| Site hero/director/contact completeness | `src/public/components/home/HomeHeroSection.tsx`, `src/public/components/home/DirectorHeroCard.tsx`, `src/public/components/home/ContactMapCard.tsx`, `src/services/siteSettings.ts` | Sections are data-driven and safe, but launch quality depends on real settings, images, contact details, and map URLs being populated.                                 | Medium                          | Launch data-entry checklist                       | Safe defaults prevent fake links/maps, but missing content is still a readiness issue.                                          |
| Homepage discovery metadata             | `src/public/pages/PublicHomePage.tsx`, `src/admin/components/ContentEditorDialog.tsx`                                                                                                | Procurement, job, achievement, and document sections rely on content category/tags/title/summary keyword matching. Presets exist, but editors can still omit metadata. | Medium                          | Content governance / required metadata validation | Not mock content. The risk is real content not appearing where staff expect.                                                    |
| Media quality and alt text              | `src/admin/pages/CarouselPage.tsx`, `src/admin/components/ContentEditorDialog.tsx`, `src/public/components/PublicHomeCarousel.tsx`                                                   | Carousel and content media are real data, but image quality, dimensions, and alt text depend on editor discipline.                                                     | Medium                          | Media governance checklist                        | Could cause poor launch presentation even with correct data.                                                                    |
| SettingsPage size/complexity            | `src/admin/pages/SettingsPage.tsx`                                                                                                                                                   | Site settings, homepage settings, visitor stats, footer links, Messenger, display settings, and user management live on one page.                                      | Low                             | Admin UX polish                                   | Operationally usable, but may become crowded for staff. This is maintainability/UX, not public mock content.                    |
| Admin-only placeholder URLs             | `src/admin/components/ContentEditorDialog.tsx`, `src/admin/components/ContentBlockBuilder.tsx`                                                                                       | Admin inputs include placeholder examples like `https://example.edu/...`.                                                                                              | Low                             | Keep or replace with school-domain guidance later | These are form placeholders, not public content. They are acceptable if editors understand they are examples.                   |
| Test fixtures and test accounts         | `src/test/*`, `src/services/auth.test.ts`                                                                                                                                            | Tests use mock APIs and emails such as `admin@example.com`.                                                                                                            | Low                             | No action                                         | Developer-only fixtures. Not bundled as public CMS data.                                                                        |
| Client-side search limitations          | `src/public/pages/PublicSearchPage.tsx`, `src/utils/search.ts`                                                                                                                       | Search uses public snapshot content only. It is functional but not server-indexed or typo-tolerant.                                                                    | Low                             | SEO/content quality checklist                     | Not mock. Document limitation for launch expectations.                                                                          |
| Legacy map URL cleanup constant         | `src/services/siteSettings.ts`, `apps-script/SiteSettings.gs`                                                                                                                        | The old Google Maps short URL remains only as a legacy cleanup constant.                                                                                               | Low                             | Keep until legacy installs are migrated           | It is no longer a default/seed value and should normalize to empty if encountered.                                              |

## Resolved since previous audit

- E-Service example links removed from public rendering.
- Visitor stats mock numbers and public Mock chip removed.
- Achievement mock cards removed.
- Footer `#` links removed from public default and filtered from public rendering.
- Messenger URL no longer hard-coded.
- Header search now submits to a functional `/search` page.
- Default Google Maps URL removed from frontend and Apps Script defaults.
- Carousel no longer uses static Unsplash/content-derived slides.
- IntroGate, Marquee, and IntroVideo no longer use bundled mock content.
- Procurement and job sections no longer use bundled mock cards.

## Remaining recommended cleanup phases

1. Content governance / required metadata validation
   - Objective: Reduce accidental omission from homepage discovery sections by nudging or validating category/tags for procurement, job, achievements, documents, and featured/searchable content.
   - Suggested files: `src/admin/components/ContentEditorDialog.tsx`, possibly `src/admin/pages/ContentPage.tsx`.
   - Backend needed: no for warnings; yes only if enforcing taxonomy server-side.
   - Admin UI needed: yes.
   - Risk: Medium.
   - Why this should come next or not: It helps staff publish correctly, but it should not block launch if the data-entry checklist is followed.

2. Admin UX polish for SettingsPage
   - Objective: Split or organize the growing settings surface so staff can find site settings, homepage settings, visitor stats, footer links, and Messenger controls more easily.
   - Suggested files: `src/admin/pages/SettingsPage.tsx`.
   - Backend needed: no.
   - Admin UI needed: yes.
   - Risk: Low.
   - Why this should come next or not: Useful after launch-critical data is populated; not a public content blocker.

3. Media governance: image dimensions and alt text reminders
   - Objective: Add clearer guidance for carousel/media uploads and required alt text for important public images.
   - Suggested files: `src/admin/pages/CarouselPage.tsx`, `src/admin/components/ContentEditorDialog.tsx`, `src/admin/pages/MediaPage.tsx`.
   - Backend needed: no for guidance; yes only if storing extra media policy fields.
   - Admin UI needed: yes.
   - Risk: Medium.
   - Why this should come next or not: Better visual quality and accessibility, but current rendering already avoids mock data.

4. SEO/content quality checklist
   - Objective: Ensure page titles, summaries, slugs, canonical URLs, content metadata, and social/media previews are ready before launch.
   - Suggested files: documentation first; optional future work in `src/admin/components/ContentEditorDialog.tsx`.
   - Backend needed: no.
   - Admin UI needed: maybe.
   - Risk: Low.
   - Why this should come next or not: Good launch discipline; not a code blocker.

5. Launch data-entry checklist
   - Objective: Provide staff a practical checklist for real values across settings, carousel, E-Service, footer, Messenger, contact/map, visitor stats, and CMS content.
   - Suggested files: `docs/production-readiness-checklist.md`.
   - Backend needed: no.
   - Admin UI needed: no.
   - Risk: Medium.
   - Why this should come next or not: This is the best next step because no serious public mock content remains, and production readiness now depends on correct real data entry.

## Immediate next recommendation

Recommend **Launch data-entry checklist / readiness execution** next. The current scan did not find remaining public fake links, public fake numbers, or public fake official claims in runtime components. The highest remaining risk is launching with empty or neutral settings, missing real media, or content that lacks the metadata needed for homepage discovery.

## Non-goals

- Do not migrate to Firebase in this audit.
- Do not rebuild backend architecture in this audit.
- Do not remove sections blindly.
- Do not convert every static label into CMS settings.
- Do not create fake seed content.
