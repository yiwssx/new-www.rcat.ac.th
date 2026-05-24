# Google API Ownership Audit - 2026-05-24

Status: audit only. No source files were moved, no imports were changed, `src/services/googleApi.ts` remains intact, and `src/types.ts` remains intact.

Related documents:

- [`p5-shared-types-audit-2026-05-24.md`](./p5-shared-types-audit-2026-05-24.md)
- [`refactor-checkpoint-p1-p4-2026-05-24.md`](./refactor-checkpoint-p1-p4-2026-05-24.md)
- [`structural-refactor-plan-2026-05-23.md`](./structural-refactor-plan-2026-05-23.md)

## Executive Summary

`src/services/googleApi.ts` is the central frontend adapter for Apps Script transport, auth-session token attachment, request activity tracking, public read APIs, public tracking writes, admin reads, admin writes, user management, health checks, and feature-specific request/response typing.

The file is functional but too broad to split casually. It imports many shared contracts from `src/types.ts`, reads project-level resource names from `src/config/project-settings.json`, stores display settings as a side effect of some public/admin reads, and is mocked or imported by public hooks, admin pages, auth/user services, feature modules, and integration tests.

Do not split `googleApi.ts` immediately. The first future implementation should be a small re-export-preserving extraction for either public documents API wrappers or the site-view API wrapper. API contract type movement from P5 should wait until the adapter facade and ownership boundaries are clearer.

## Export Inventory

| Export                             | Purpose                                                                       | Scope                             | Resource and Apps Script route/function                                                   | Related type/cache contract                                                                         | Current callers                                                                            | Future owner                                                              | Move risk and timing                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `getGoogleApiActivityCount`        | Read current in-flight API request count.                                     | Shared/admin UX                   | No route. Local request activity state.                                                   | Local activity state only.                                                                          | `AdminActionProgress.tsx`.                                                                 | `src/shared/api/activity.ts`                                              | Medium. Move later with activity facade.                                       |
| `subscribeGoogleApiActivity`       | Subscribe admin progress UI to request count changes.                         | Shared/admin UX                   | No route. Local request activity state.                                                   | Local subscriber set only.                                                                          | `AdminActionProgress.tsx`.                                                                 | `src/shared/api/activity.ts`                                              | Medium. Move later because all transport calls update it.                      |
| `UserAccountInput`                 | Payload shape for saving backend users.                                       | Admin/auth                        | `POST users` -> `upsertUser(payload)`.                                                    | `UserAccount` from `src/types.ts`.                                                                  | `services/users.ts`.                                                                       | `src/features/auth/api.ts` or `src/features/auth/types.ts`                | High. Move late with auth/user ownership.                                      |
| `CalendarEventInput`               | Payload shape for calendar event saves.                                       | Admin                             | `POST event` -> `upsertEvent(payload)`.                                                   | `CalendarEvent` from `src/types.ts`.                                                                | Function signature for `saveCalendarEvent`; no direct type import outside `googleApi.ts`.  | `src/features/events/api.ts`                                              | Medium. Move later.                                                            |
| `MediaAssetInput`                  | Payload shape for media save/upload flows.                                    | Admin/media                       | `POST media` -> `upsertMedia(payload)`.                                                   | `MediaAsset`, `MediaType` from `src/types.ts`.                                                      | `ContentPage.tsx`, `ContentEditorDialog.tsx`.                                              | `src/features/media/api.ts`                                               | High. Move later because media crosses content editing and library management. |
| `CarouselSlideInput`               | Partial carousel slide payload.                                               | Admin/public-home settings        | `POST carousel` -> `upsertCarouselSlide(payload)`.                                        | `CarouselSlide` from `src/types.ts`.                                                                | Function signature only.                                                                   | `src/features/public-home/api.ts` or `src/features/carousel/api.ts`       | Medium. Move later.                                                            |
| `ExternalServiceLinkInput`         | Partial external-service payload.                                             | Admin/public-home                 | `POST external-service` -> `upsertExternalService(payload)`.                              | `ExternalServiceLink` from `src/types.ts`.                                                          | Function signature only.                                                                   | `src/features/external-services/api.ts`                                   | Medium. Move later.                                                            |
| `DocumentItemInput`                | Partial admin document payload.                                               | Admin/documents                   | `POST document` -> `upsertDocument(payload)`.                                             | `CmsDocumentItem` from `src/types.ts`.                                                              | `DocumentsPage.tsx`.                                                                       | `src/features/cms-documents/api.ts`                                       | Low-medium. Move after public-documents wrapper.                               |
| `loginUserFromApi`                 | Backend login request returning a session.                                    | Auth                              | `POST auth-login` -> `loginUser(payload)`.                                                | `Session`; no auth token attached.                                                                  | `services/auth.ts`, `auth.test.ts`.                                                        | `src/features/auth/api.ts`                                                | High. Move late or separately.                                                 |
| `getCmsSnapshot`                   | Public CMS snapshot read.                                                     | Public read                       | `GET snapshot` -> `getPublicSnapshotCached()` when unauthenticated.                       | `CmsSnapshot`; writes display settings into localStorage.                                           | `usePublicCmsSnapshot.ts`, integration test.                                               | `src/features/public-content/api.ts` or `src/features/public-home/api.ts` | High. Defer; broad snapshot contract.                                          |
| `getPublicHomeSnapshot`            | Public homepage snapshot read.                                                | Public read                       | `GET public-home` -> `getPublicHomeSnapshotCached()`.                                     | `PublicHomeSnapshot`; writes display settings into localStorage; hook caches via `publicHomeCache`. | `usePublicHomeSnapshot.ts`, Apps Script/cache tests.                                       | `src/features/public-home/api.ts`                                         | Medium-high. Defer until public-home ownership is mapped.                      |
| `getPublicContentListSnapshot`     | Public list read for news, announcements, or blog.                            | Public read                       | `GET public-content-list` -> `getPublicContentListSnapshotCached(query)`.                 | `PublicContentListKind`, `PublicContentListSnapshot`; writes display settings; hook caches by kind. | `usePublicContentList.ts`, Apps Script/cache tests.                                        | `src/features/public-content/api.ts`                                      | Medium-high. Move later.                                                       |
| `getPublicDocumentList`            | Public document list read.                                                    | Public read                       | `GET public-document-list` -> `getPublicDocumentListCached()`.                            | `PublicDocumentListSnapshot`; feature cache key `rcat.cms.public.document-list`.                    | Integration test; public feature cache uses the snapshot type but not this function today. | `src/features/public-documents/api.ts`                                    | Low-medium. Safe first candidate.                                              |
| `getPublicProgramListSnapshot`     | Public program list read.                                                     | Public read                       | `GET public-program-list` -> `getPublicProgramListSnapshotCached()`.                      | `PublicProgramListSnapshot`; hook cache helper owns public-program cache.                           | `usePublicProgramList.ts`, Apps Script/cache tests.                                        | `src/features/public-content/api.ts`                                      | Medium-high. Move later.                                                       |
| `getPublicSearchIndexSnapshot`     | Public search index read.                                                     | Public read/search                | `GET public-search-index` -> `getPublicSearchIndexSnapshotCached()`.                      | `PublicSearchIndexSnapshot`; hook/cache helpers own search cache.                                   | `usePublicSearchIndex.ts`, Apps Script/cache tests.                                        | `src/features/public-content/api.ts` or `src/features/search/api.ts`      | Medium. Move later.                                                            |
| `getAdminCmsSnapshot`              | Authenticated admin snapshot read.                                            | Admin read                        | `POST snapshot-admin` -> `getSnapshot({ includeUnpublished: true })`.                     | `CmsSnapshot`; attaches auth token; writes display settings into localStorage.                      | 8 admin pages plus integration test.                                                       | `src/features/cms-dashboard/api.ts` or shared admin API facade            | High. Keep until admin reads are mapped.                                       |
| `saveContentItem`                  | Save content record.                                                          | Admin write/content               | `POST content` -> `upsertContent(payload)`.                                               | `ContentItem`; attaches auth token.                                                                 | `ContentPage.tsx`.                                                                         | `src/features/cms-content/api.ts`                                         | High. Move after content ownership audit.                                      |
| `getContentDetail`                 | Public content detail read by id or slug.                                     | Public read/content               | `GET content-detail` -> `getPublicContentDetailCached(query)`.                            | `ContentItem`; public detail cache wraps callers.                                                   | `usePublicContentDetail.ts`, Apps Script/cache tests.                                      | `src/features/public-content/api.ts`                                      | Medium-high. Move later.                                                       |
| `ContentViewResponse`              | Response shape for public content-view increment.                             | Public tracking/content           | `POST content-view` -> `incrementContentView(payload)`.                                   | Local response interface; unauthenticated write.                                                    | Function signature only.                                                                   | `src/features/public-content/api.ts`                                      | Medium. Move with content-view wrapper.                                        |
| `recordContentView`                | Fire a public content view increment.                                         | Public write/tracking             | `POST content-view` -> `incrementContentView(payload)`.                                   | `ContentViewResponse`; unauthenticated `postJson`.                                                  | `PublicContentDetailPage.tsx`, content detail tests, integration test.                     | `src/features/public-content/api.ts`                                      | Medium. Move later; keep non-blocking page behavior verified.                  |
| `SiteViewInput`                    | Site-view tracking payload.                                                   | Public tracking                   | `POST site-view` -> `incrementSiteView(payload)`.                                         | Local interface; backend mirrored by `normalizeSiteViewInput`.                                      | `features/site-view`, site-view tests.                                                     | `src/features/site-view/api.ts` or `types.ts` in that feature             | Low-medium. Safe first candidate with facade.                                  |
| `recordSiteView`                   | Fire-and-forget site-view write using `sendBeacon` or `fetch(... keepalive)`. | Public write/tracking             | `POST site-view` -> `incrementSiteView(payload)`.                                         | `SiteViewInput`; bypasses `postJson`, no activity tracking, no auth token.                          | `features/site-view`, site-view tests.                                                     | `src/features/site-view/api.ts`                                           | Low-medium. Safe first candidate.                                              |
| `getAdminContentDetail`            | Authenticated content detail read including unpublished data.                 | Admin read/content                | `POST content-detail-admin` -> `getContentDetail(payload, { includeUnpublished: true })`. | `ContentItem`; attaches auth token.                                                                 | `ContentPage.tsx`.                                                                         | `src/features/cms-content/api.ts`                                         | Medium-high. Move with CMS content API.                                        |
| `deleteContentItem`                | Delete content record.                                                        | Admin write/content               | `POST content-delete` -> `deleteContent(payload.id)`.                                     | `{ id, deleted }`; attaches auth token.                                                             | `ContentPage.tsx`.                                                                         | `src/features/cms-content/api.ts`                                         | High. Move later.                                                              |
| `saveDocumentToApi`                | Save admin document.                                                          | Admin write/documents             | `POST document` -> `upsertDocument(payload)`.                                             | `CmsDocumentItem`, `DocumentItemInput`; attaches auth token.                                        | `DocumentsPage.tsx`, integration test.                                                     | `src/features/cms-documents/api.ts`                                       | Low-medium. Good early candidate after public document read.                   |
| `deleteDocumentFromApi`            | Delete admin document.                                                        | Admin write/documents             | `POST document-delete` -> `deleteDocument(payload.id)`.                                   | `{ id, deleted }`; attaches auth token.                                                             | `DocumentsPage.tsx`, integration test.                                                     | `src/features/cms-documents/api.ts`                                       | Low-medium. Good early candidate after public document read.                   |
| `saveCarouselSlideToApi`           | Save carousel slide.                                                          | Admin write/public-home           | `POST carousel` -> `upsertCarouselSlide(payload)`.                                        | `CarouselSlide`, `CarouselSlideInput`; attaches auth token.                                         | `CarouselPage.tsx`.                                                                        | `src/features/carousel/api.ts`                                            | Medium. Move later.                                                            |
| `deleteCarouselSlideFromApi`       | Delete carousel slide.                                                        | Admin write/public-home           | `POST carousel-delete` -> `deleteCarouselSlide(payload.id)`.                              | `{ id, deleted }`; attaches auth token.                                                             | `CarouselPage.tsx`.                                                                        | `src/features/carousel/api.ts`                                            | Medium. Move later.                                                            |
| `saveExternalServiceLinkToApi`     | Save external service link.                                                   | Admin write/home section          | `POST external-service` -> `upsertExternalService(payload)`.                              | `ExternalServiceLink`, `ExternalServiceLinkInput`; attaches auth token.                             | `ExternalServicesPage.tsx`.                                                                | `src/features/external-services/api.ts`                                   | Medium. Move later.                                                            |
| `deleteExternalServiceLinkFromApi` | Delete external service link.                                                 | Admin write/home section          | `POST external-service-delete` -> `deleteExternalService(payload.id)`.                    | `{ id, deleted }`; attaches auth token.                                                             | `ExternalServicesPage.tsx`.                                                                | `src/features/external-services/api.ts`                                   | Medium. Move later.                                                            |
| `getPublicMenuItems`               | Public menu read for admin menu editor.                                       | Shared/admin navigation           | `GET menu` -> `{ items: getMenu() }`.                                                     | `PublicMenuItem[]`; cache-friendly GET.                                                             | `MenuPage.tsx`.                                                                            | `src/features/navigation/api.ts`                                          | Medium. Move later.                                                            |
| `savePublicMenuItems`              | Save menu tree.                                                               | Admin write/navigation            | `POST menu` -> `replaceMenu(payload.items)`.                                              | `PublicMenuItem[]`; attaches auth token.                                                            | `MenuPage.tsx`.                                                                            | `src/features/navigation/api.ts`                                          | Medium. Move later.                                                            |
| `uploadMediaAsset`                 | Upload/save media asset through media resource.                               | Admin write/media                 | `POST media` -> `upsertMedia(payload)`.                                                   | `MediaAsset`; attaches auth token.                                                                  | No current callers found.                                                                  | `src/features/media/api.ts`                                               | Medium. Keep until a separate unused-export review decides.                    |
| `saveMediaAsset`                   | Save media asset metadata/file payload.                                       | Admin write/media                 | `POST media` -> `upsertMedia(payload)`.                                                   | `MediaAssetInput`, `MediaAsset`; attaches auth token.                                               | `MediaPage.tsx`, `ContentPage.tsx`.                                                        | `src/features/media/api.ts`                                               | High. Move later.                                                              |
| `deleteMediaAsset`                 | Delete media record and Drive file by default.                                | Admin write/media                 | `POST media-delete` -> `deleteMedia(payload.id, deleteDriveFile)`.                        | `{ id, deleted }`; attaches auth token.                                                             | `MediaPage.tsx`.                                                                           | `src/features/media/api.ts`                                               | High. Move later.                                                              |
| `publishContent`                   | Publish content from admin.                                                   | Admin write/content               | `POST publish` -> `publishContent(payload.id)`.                                           | `{ id, published }`; attaches auth token.                                                           | `DashboardPage.tsx`, `ContentPage.tsx`, Apps Script code test.                             | `src/features/cms-content/api.ts`                                         | High. Move later.                                                              |
| `saveCalendarEvent`                | Save event/calendar entry.                                                    | Admin write/events                | `POST event` -> `upsertEvent(payload)`.                                                   | `CalendarEventInput`, `CalendarEvent`; attaches auth token.                                         | `CalendarPage.tsx`, integration test.                                                      | `src/features/events/api.ts`                                              | Medium. Move later.                                                            |
| `deleteCalendarEvent`              | Delete event/calendar entry.                                                  | Admin write/events                | `POST event-delete` -> `deleteEvent(payload.id)`.                                         | `{ id, deleted }`; attaches auth token.                                                             | `CalendarPage.tsx`.                                                                        | `src/features/events/api.ts`                                              | Medium. Move later.                                                            |
| `getDisplaySettingsFromApi`        | Read display/date settings.                                                   | Public/admin settings             | `GET display-settings` -> `getDisplaySettings()`.                                         | `DisplaySettings`; service caches in localStorage.                                                  | `services/displaySettings.ts`.                                                             | `src/features/settings/api.ts`                                            | Medium. Move later.                                                            |
| `saveDisplaySettingsToApi`         | Save display/date settings.                                                   | Admin write/settings              | `POST display-settings` -> `updateDisplaySettings(payload)`.                              | `DisplaySettings`; attaches auth token.                                                             | `services/displaySettings.ts`.                                                             | `src/features/settings/api.ts`                                            | Medium. Move later.                                                            |
| `saveSiteSettingsToApi`            | Save site shell/contact/branding settings.                                    | Admin-only settings               | `POST site-settings` -> `updateSiteSettings(payload)`.                                    | `SiteSettings`; requires admin role in Apps Script.                                                 | `SettingsPage.tsx`, integration test.                                                      | `src/features/settings/api.ts`                                            | High. Move later.                                                              |
| `saveHomepageSettingsToApi`        | Save homepage settings.                                                       | Admin-only settings/public home   | `POST homepage-settings` -> `updateHomepageSettings(payload)`.                            | `HomepageSettings`; requires admin role.                                                            | `SettingsPage.tsx`, `CarouselPage.tsx`.                                                    | `src/features/settings/api.ts` or `src/features/public-home/api.ts`       | Medium-high. Move later.                                                       |
| `saveVisitorStatsToApi`            | Save visitor stats enable/disable settings.                                   | Admin-only settings/visitor stats | `POST visitor-stats` -> `updateVisitorStats(payload)`.                                    | `VisitorStatsSettings`; requires admin role.                                                        | `SettingsPage.tsx`.                                                                        | `src/features/visitor-stats/api.ts`                                       | Low-medium. Possible early move after site-view/public-documents.              |
| `getUserAccountsFromApi`           | List user accounts.                                                           | Admin-only auth/users             | `POST users` with `{ action: "list" }` -> `getUsers()`.                                   | `{ items: UserAccount[] }`; attaches auth token.                                                    | `services/users.ts`, users tests.                                                          | `src/features/auth/api.ts`                                                | High. Move late.                                                               |
| `saveUserAccountToApi`             | Save user account.                                                            | Admin-only auth/users             | `POST users` -> `upsertUser(payload)`.                                                    | `UserAccountInput`, `UserAccount`; attaches auth token.                                             | `services/users.ts`, users tests.                                                          | `src/features/auth/api.ts`                                                | High. Move late.                                                               |
| `deleteUserAccountFromApi`         | Delete user account.                                                          | Admin-only auth/users             | `POST users-delete` -> `deleteUser(payload.id)`.                                          | `{ id, deleted }`; attaches auth token.                                                             | `services/users.ts`, users tests.                                                          | `src/features/auth/api.ts`                                                | High. Move late.                                                               |
| `resetUserAccountsFromApi`         | Reset user accounts.                                                          | Admin-only auth/users             | `POST users-reset` -> `resetUsers()`.                                                     | `{ items: UserAccount[] }`; attaches auth token.                                                    | `services/users.ts`, users tests.                                                          | `src/features/auth/api.ts`                                                | High. Move late.                                                               |
| `checkGoogleConnection`            | Convert backend health response into integration status cards.                | Admin/integrations                | `GET health` -> inline Apps Script health object.                                         | `IntegrationStatus[]`, local `HealthResponse`; cache-friendly GET.                                  | `IntegrationsPage.tsx`.                                                                    | `src/features/integrations/api.ts`                                        | Medium. Move later.                                                            |

Internal non-exported responsibilities that should remain mapped before any split:

- `resources`, `GoogleResource`, `assertAppScriptUrl`, `googleFetch`, `postJson`, `ApiEnvelope`, request timeout handling, cache-friendly GET classification, unauthenticated POST classification, session-token reading, display-settings persistence, and request activity notification.

## Responsibility Groups

### A. Transport And Core Request Layer

Current owner: `src/services/googleApi.ts`.

Included behavior:

- Apps Script URL resolution through `getGoogleAppsScriptUrl()`.
- Resource-name lookup through `projectSettings.api.resources`.
- `googleFetch()` URL building, query parameters, timeout/abort handling, `fetch`, JSON parsing, `ApiEnvelope` error handling, and cache mode selection.
- `postJson()` `text/plain;charset=utf-8` JSON payloads for Apps Script compatibility.
- Cache-friendly public GET allow-list.
- Unauthenticated public POST allow-list.

Future owner: `src/shared/api/transport.ts`, `src/shared/api/appsScriptClient.ts`, and `src/shared/api/errors.ts`.

Do not move this first. It is the load-bearing layer for every exported API wrapper.

### B. Auth And Session API

Current owner: split between `googleApi.ts`, `auth.ts`, `authSession.ts`, and `users.ts`.

Included behavior:

- `loginUserFromApi()`.
- `readStoredSessionToken()` inside `googleApi.ts`.
- Authenticated `postJson()` token attachment.
- User account API wrappers.

Future owner: `src/features/auth/api.ts`, with session parsing staying near `authSession.ts` or a feature auth module.

Move late. Auth touches session storage, role checks, user management, dynamic imports, and router protection.

### C. Public Read APIs

Current owner: `googleApi.ts` wrappers plus feature/service cache helpers.

Included wrappers:

- `getCmsSnapshot()`
- `getPublicHomeSnapshot()`
- `getPublicContentListSnapshot()`
- `getPublicDocumentList()`
- `getPublicProgramListSnapshot()`
- `getPublicSearchIndexSnapshot()`
- `getContentDetail()`
- `getPublicMenuItems()`
- `getDisplaySettingsFromApi()`

Future owners:

- `src/features/public-home/api.ts`
- `src/features/public-content/api.ts`
- `src/features/public-documents/api.ts`
- `src/features/navigation/api.ts`
- `src/features/settings/api.ts`

Move in small groups. Public document list is the best first candidate because P4 already created `src/features/public-documents`.

### D. Public Write And Tracking APIs

Current owner: `googleApi.ts` plus `src/features/site-view/siteViewTracking.ts` and public content detail page behavior.

Included wrappers:

- `recordContentView()`
- `recordSiteView()`

Future owners:

- `src/features/site-view/api.ts`
- `src/features/public-content/api.ts`

`recordSiteView()` is isolated and can move early if `googleApi.ts` remains a facade re-export. `recordContentView()` should wait for public content ownership because it is tied to content detail behavior.

### E. Admin Read APIs

Current owner: `googleApi.ts`.

Included wrappers:

- `getAdminCmsSnapshot()`
- `getAdminContentDetail()`
- `checkGoogleConnection()`

Future owners:

- `src/features/cms-dashboard/api.ts`
- `src/features/cms-content/api.ts`
- `src/features/integrations/api.ts`

Move later. `getAdminCmsSnapshot()` has the most admin callers and should not be split before admin snapshot ownership is documented.

### F. Admin Write APIs

Current owner: `googleApi.ts`.

Included wrappers:

- Content save/delete/publish.
- Document save/delete.
- Carousel save/delete.
- External service save/delete.
- Media save/delete.
- Event save/delete.
- Menu save.
- Display/site/homepage/visitor settings saves.
- User save/delete/reset.

Future owners:

- `src/features/cms-content/api.ts`
- `src/features/cms-documents/api.ts`
- `src/features/media/api.ts`
- `src/features/settings/api.ts`
- `src/features/navigation/api.ts`
- `src/features/events/api.ts`
- `src/features/auth/api.ts`

Admin document wrappers are the lowest-risk admin write split after public documents. Content, media, users, and broad settings should wait.

### G. Request Activity And Progress Tracking

Current owner: `googleApi.ts`, consumed by `AdminActionProgress.tsx`.

Included behavior:

- In-flight request counter.
- Subscriber set.
- Begin/end notification from every `googleFetch()` request.

Future owner: `src/shared/api/activity.ts`.

Move only with the transport layer or with a stable adapter facade. Moving it before transport risks desynchronizing progress UI from actual requests.

## Current Coupling Risks

- `googleApi.ts` imports many shared API and UI-facing contracts from `src/types.ts`, making type movement risky before adapter ownership is clear.
- Transport, typed API wrappers, auth token attachment, public reads, admin writes, public tracking writes, integration health mapping, and activity tracking share one file.
- Public read caching is split: `googleApi.ts` performs the fetch and sometimes persists display settings, while hooks and feature/service cache helpers own localStorage cache keys and TTLs.
- Admin writes and public reads share the same transport and type import surface.
- Auth/session token reading lives next to unrelated CMS calls.
- Tests import or mock `googleApi.ts` broadly, especially `googleApi.integration.test.ts`, public content detail tests, and site-view tests.
- Future Cloudflare D1 or non-Apps-Script backend migration will be harder while transport and resource wrappers are coupled.
- `recordSiteView()` intentionally bypasses `googleFetch()` and request activity tracking. A future split must preserve that fire-and-forget behavior.
- `getAdminCmsSnapshot()` is called by many admin pages; moving it too early would create high import churn without reducing feature risk.

## Recommended Target Architecture

Do not create these files in this audit. This is the target map for future work.

```text
src/shared/api/
  transport.ts
  errors.ts
  activity.ts
  appsScriptClient.ts

src/features/auth/api.ts
src/features/public-home/api.ts
src/features/public-content/api.ts
src/features/public-documents/api.ts
src/features/site-view/api.ts
src/features/cms-content/api.ts
src/features/cms-documents/api.ts
src/features/media/api.ts
src/features/settings/api.ts
src/features/navigation/api.ts
src/features/events/api.ts
```

Recommended facade rule: keep `src/services/googleApi.ts` as a compatibility facade during early splits. It can re-export moved wrappers so existing imports remain stable while one feature API module at a time is proven safe.

## Migration Sequence

### G0 Audit Only

This task. No source changes.

### G1 Extract Pure Transport Helpers

Extract only transport internals into `src/shared/api/*` while preserving every exported function name from `googleApi.ts`.

Safety requirements:

- `googleApi.ts` remains the public facade.
- `googleFetch()` behavior, timeout handling, `ApiEnvelope` parsing, cache mode selection, request activity, and auth-token attachment remain identical.
- `googleApi.integration.test.ts`, auth tests, public cache tests, and admin page tests pass.

### G2 Add Or Preserve Re-Export Facade

Keep old imports working from `src/services/googleApi.ts`.

This avoids changing dozens of feature imports in the same PR that extracts transport.

### G3 Move Public-Documents API Wrappers First

Move `getPublicDocumentList()`, then later `saveDocumentToApi()` and `deleteDocumentFromApi()` if admin document ownership is also being touched.

This is low-medium risk because P4 already owns public document UI/cache in `src/features/public-documents`.

### G4 Move Site-View API Wrapper

Move `SiteViewInput` and `recordSiteView()` only if the facade preserves current imports.

Safety requirements:

- `sendBeacon` first.
- `fetch(... keepalive)` fallback.
- Returns `false` only when no browser transport is available or setup fails.
- No auth token.
- No request activity tracking.
- No UI errors.

### G5 Move Public Content/Home Read Wrappers

Move public content/home APIs after public read cache ownership is documented.

Avoid changing cache keys, display-settings persistence, query keys, or response contracts.

### G6 Move Admin Document/Content Write Wrappers

Start with documents, then content only after content ownership is mapped.

Do not mix document API extraction with Apps Script document behavior changes.

### G7 Move Auth/Session Last Or Separately

Move login and user account wrappers only in an auth-focused PR.

Do not combine auth with public/API split work.

### G8 Revisit API Contract Type Moves

Only after the API wrappers have clearer owners should P5 type movement continue for API contracts.

## Safe First Implementation Candidate

Best first future split: `getPublicDocumentList()` into `src/features/public-documents/api.ts`, with `src/services/googleApi.ts` re-exporting it.

Second safe candidate: `recordSiteView()` and `SiteViewInput` into `src/features/site-view/api.ts`, also re-exported from `googleApi.ts`.

Either candidate should be a small PR with import-path changes avoided or minimized. Do not move shared response contracts from `src/types.ts` in the same PR.

## What Must Not Move Early

- `ApiEnvelope`, `googleFetch()`, `postJson()`, `readStoredSessionToken()`, and Apps Script resource resolution.
- Auth/session/user account wrappers.
- `getAdminCmsSnapshot()`.
- Broad public snapshot and public-home contracts.
- Content/media wrappers.
- Request activity tracking unless transport is being moved with it.
- Display-settings persistence side effects.

## Risk Matrix

| Responsibility group         | Current coupling                                                                                                          | Move risk            | Recommended phase     | Required tests                                                                                        | Notes                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Transport/core request layer | All wrappers depend on `googleFetch`, `postJson`, `resources`, timeout, error parsing, cache mode, and activity tracking. | High                 | G1 with facade only   | `googleApi.integration.test.ts`, public cache tests, auth/users tests, admin page tests, full quality | Do not alter public function names.                                          |
| Auth/session API             | Token reading and user wrappers share admin-only resources and session contracts.                                         | High                 | G7                    | auth tests, users tests, router auth integration, google API integration                              | Move separately from public APIs.                                            |
| Public read APIs             | Fetch wrappers are separate from local cache helpers; some persist display settings.                                      | Medium-high          | G3 then G5            | public cache tests, public data-driven page tests, integration tests                                  | Public documents first; public-home later.                                   |
| Public tracking APIs         | `recordSiteView` bypasses normal transport; `recordContentView` uses unauthenticated `postJson`.                          | Low-medium to medium | G4 then G5            | site-view tests, public content detail tests, Apps Script code/storage tests                          | Preserve fire-and-forget behavior.                                           |
| Admin read APIs              | `getAdminCmsSnapshot` has many page callers and broad `CmsSnapshot` contract.                                             | High                 | G6 or later           | admin pages, integration tests, build                                                                 | Do not move until admin snapshot ownership is mapped.                        |
| Admin write APIs             | Many resource wrappers attach auth and invalidate backend public caches indirectly.                                       | Medium-high to high  | G6+                   | focused admin page tests, Apps Script tests, integration tests                                        | Documents are the safest first admin write group.                            |
| Activity/progress tracking   | Tied to every `googleFetch()` request and admin progress UI.                                                              | Medium-high          | G1 or after transport | AdminActionProgress tests if present, lint/build, manual admin save smoke                             | Do not separate from transport unless facade keeps notifications consistent. |

## Search Command Summary

- `rg 'from .+services/googleApi' src`: found current imports from public hooks, admin pages/components, feature site-view, and tests. This was the PowerShell-safe equivalent of the requested relative import scan.
- `rg "recordSiteView|fetchPublicHome|fetchPublicDocumentList|saveDocument|deleteDocument|login|snapshot-admin|public-home|site-view" src/services/googleApi.ts src`: confirmed current wrapper names are `getPublicHomeSnapshot` and `getPublicDocumentList`; no `fetchPublicHome` or `fetchPublicDocumentList` exports exist. Also confirmed site-view, login, document API, route, and test coverage references.
- `rg "resource" src/services/googleApi.ts`: confirmed resource lookup is centralized through `projectSettings.api.resources`, with `googleFetch()`, `postJson()`, and `recordSiteView()` building resource-specific requests.
- `rg "ApiEnvelope|SiteViewInput|PublicHomeSnapshot|PublicDocumentListSnapshot|ContentItem|MediaAsset|User|Session" src/services/googleApi.ts src`: confirmed `googleApi.ts` has dense type-contract coupling and those contracts are also spread across public pages, admin pages, services, feature modules, and tests.
- `rg "googleApi" src/test`: found tests that mock or directly import `googleApi.ts`: site-view tests, public content detail tests, and `googleApi.integration.test.ts`.
- `rg "^export (async function|function|interface|type|const)" src/services/googleApi.ts -n`: found 48 exported functions/interfaces/types and no exported constants.

## Verification Command Summary

| Command                 | Result                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm format:check`     | Passed after formatting this new Markdown document with `pnpm format`.                                                                                                                                 |
| `pnpm lint:report`      | Passed with no reported ESLint warnings.                                                                                                                                                               |
| `pnpm lint:errors`      | Passed with no ESLint errors.                                                                                                                                                                          |
| `pnpm test:unit`        | Passed: 33 test files, 264 tests. Existing non-blocking test warnings appeared for jsdom localStorage-file configuration and some public page tests using router hooks outside a full router provider. |
| `pnpm test:integration` | Passed: 2 test files, 10 tests. Existing non-blocking localStorage-file warnings appeared.                                                                                                             |
| `pnpm build`            | Passed. Generated `public/sitemap.xml` with 8 URLs and produced the Vite production build. Existing Vite warning remained for `bcryptjs` importing browser-externalized `crypto`.                      |
| `pnpm quality`          | Passed. It reran `format:check`, `lint`, unit tests, integration tests, and build with the same non-blocking warnings noted above.                                                                     |

## Decision

Do not split `googleApi.ts` immediately.

First future split should be one of:

1. `getPublicDocumentList()` into `src/features/public-documents/api.ts`, with a facade re-export from `src/services/googleApi.ts`.
2. `recordSiteView()` and `SiteViewInput` into `src/features/site-view/api.ts`, with a facade re-export from `src/services/googleApi.ts`.

Groups that must wait:

- Auth/session/user APIs.
- Core transport and `ApiEnvelope` unless handled as a facade-preserving G1.
- Public-home and broad snapshot contracts.
- Admin snapshot.
- Content and media APIs.
- Request activity tracking unless it moves with transport.

Impact on P5 shared-types implementation:

- Do not move API contract types before `googleApi.ts` has at least a facade/ownership plan.
- Public-document and site-view type movement remain the safest first P5 candidates, but only in a type-only PR or paired with a tiny API facade split.
- Public-home, content, media, settings, auth, and snapshot types should remain deferred because their current contracts still converge through `googleApi.ts`.
