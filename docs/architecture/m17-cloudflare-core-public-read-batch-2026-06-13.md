# M17 Cloudflare Core Public Read Batch Migration

Status: public read API foundation, route skeleton, and parity plan. This is not a production cutover.

## Purpose

M17 replaces endpoint-by-endpoint milestone sprawl with a grouped Cloudflare Core Public Read API layer.

The public read layer is migrated as one coherent foundation before admin writes, auth, media upload/delete, or final production domain cutover.

## Current Context

M15.2 real execute cutover remains deferred.

M16 Cloudflare-first direction remains active.

The replacement system may use Cloudflare Worker endpoints only in dev/preview replacement-system mode.

Replacement-system endpoints before final cutover: dev/preview Worker origins only.

The old live system remains on the real production domain until final cutover is explicitly approved.

No production Vercel environment mutation, Worker production deploy, D1 production migration, D1 production import, or D1 production write occurs in M17.

## Dev/Preview Enforcement

M17 uses the M16 policy:

- `VITE_BACKEND_MIGRATION_MODE=cloudflare-first-preview`
- `VITE_PUBLIC_API_PROVIDER=cloudflare`
- `VITE_CLOUDFLARE_PUBLIC_API_URL=<dev-or-preview-worker-origin>`

M17 does not weaken M15 production validation.

Vercel preview URLs must not pass as production frontend URLs.

Preview, staging, dev, test, or sandbox Worker origins must not pass as production Worker URLs.

Apps Script fallback remains available until each public read endpoint is fully implemented and parity-verified.

## M17 Scope

In scope:

- Cloudflare Worker route skeletons for the public read layer
- typed route contract registry
- safe 501 responses for routes not implemented yet
- existing `public-document-list` route preserved
- route availability and leak-safety tests
- architecture and current status documentation

Out of scope:

- real production cutover
- production Vercel environment mutation
- real production domain routing
- Worker production deploy
- production D1 import, migration, or write
- admin write migration
- auth migration
- media upload/delete migration
- Apps Script modification
- `src/services/googleApi.ts` rewrite
- removing Apps Script fallback
- broad UI behavior changes

## Route Contract Plan

All public read routes allow `GET` and `OPTIONS` only in M17.

Unimplemented routes return:

```json
{
  "error": "Not implemented",
  "resource": "<resource-name>",
  "phase": "M17"
}
```

The response is intentionally not shaped like a successful production snapshot.

| Route                           | Resource               | Expected Response Type            | Current Source                                            | Target D1 Tables                                                                                                                        | Fallback Behavior                                                  | Parity Test Requirement                                     | M17 Behavior |
| ------------------------------- | ---------------------- | --------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- | ------------ |
| `GET /api/public/documents`     | `public-document-list` | `PublicDocumentListSnapshot`      | Cloudflare D1 route with Apps Script fallback in frontend | `documents`                                                                                                                             | Apps Script fallback remains available in frontend provider switch | shape, ordering, count, public fields, no internal row keys | implemented  |
| `GET /api/public/home`          | `public-home`          | `PublicHomeSnapshot`              | Apps Script                                               | site settings, homepage settings, display settings, menu, carousel, external services, content, documents, events, media, visitor stats | Apps Script until D1 parity exists                                 | full homepage snapshot parity and UI smoke                  | safe 501     |
| `GET /api/public/content`       | `content-list`         | `PublicContentListSnapshot`       | Apps Script                                               | content, media, site settings, homepage settings, display settings, menu                                                                | Apps Script until D1 parity exists                                 | type/status/order parity and public fields only             | safe 501     |
| `GET /api/public/content/:slug` | `content-detail`       | `ContentItem` public detail shape | Apps Script                                               | content, media metadata, content view stats                                                                                             | Apps Script until D1 parity exists                                 | slug parity, public body fields, no internal document ids   | safe 501     |
| `GET /api/public/search`        | `search`               | `PublicSearchIndexSnapshot`       | Apps Script                                               | content search projection, site settings, homepage settings, display settings, menu                                                     | Apps Script until D1 parity exists                                 | query parity and no private fields                          | safe 501     |
| `GET /api/public/programs`      | `program`              | `PublicProgramListSnapshot`       | Apps Script                                               | content/program projection, media, site settings, homepage settings, display settings, menu                                             | Apps Script until D1 parity exists                                 | program list parity and public media metadata               | safe 501     |
| `GET /api/public/visitor-stats` | `visitor-stats`        | `VisitorStatsSettings`            | Apps Script                                               | visitor daily stats and aggregate view                                                                                                  | Apps Script until D1 parity exists                                 | counter parity and cache behavior                           | safe 501     |

## Field Safety

Public read responses must expose public fields only.

Committed fixtures and tests must not include:

- production URLs
- Worker URLs
- D1 ids
- account ids
- tokens or secrets
- full records
- Google Drive raw URLs
- Apps Script endpoint URLs
- raw D1 row keys such as snake_case storage columns
- stack traces, SQL text, or database error details

## Site View

Site-view read/write is planned with the public read batch, but no write migration is implemented in M17.

The first safe write path should be designed separately with throttling, privacy-safe fields, replay protection, and non-production verification.

## Rollback Strategy

For dev/preview testing, rollback means removing the explicit Cloudflare provider env values or setting the frontend provider back to Apps Script.

For production cutover work, M15 rollback safety remains unchanged and M15.2 remains deferred.

## Acceptance For M17

M17 is accepted when:

- grouped public read route registry exists
- `public-document-list` still works as before
- public read skeleton routes exist for home, content list, content detail, search, programs, and visitor stats
- unimplemented routes return safe 501 responses
- tests prove no stack, SQL, internal field, production endpoint, Google Drive endpoint, Apps Script endpoint, or secret leakage
- M16 dev/preview policy remains strict
- Apps Script fallback remains available
- no production mutation occurs

## Next Phase

M18: Admin + D1 Write Batch Migration.

M18 should start only after public read parity work is sufficiently stable in dev/preview, and it must not remove the media bridge role until media upload/delete has a dedicated migration plan.
