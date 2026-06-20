# M19 Parity And Gap Assessment

Status: M19 assessment started. This checkpoint records evidence and readiness gaps only. It is not a production cutover.

## Executive Summary

M16 established the Cloudflare-first target, M17 implemented and externally smoke-tested a grouped non-production public-read Worker foundation, and M18 implemented and externally smoke-tested a non-production structured admin write lifecycle. The repository now has a credible Worker + D1 replacement foundation, but it is not yet application-parity complete or production-cutover ready.

The principal blocking gaps are:

- The React frontend selects Cloudflare for `public-document-list` only. Public home, content, search, programs, visitor stats, site-view, and content-view flows still call Apps Script.
- Most M17 Worker contracts are minimum preview contracts, not the richer response shapes currently consumed by React. Public home is the largest mismatch.
- M18 frontend wiring covers the admin snapshot plus content and document mutations. Home sections, visitor daily stats, settings, navigation, carousel, external services, events, users, and media are not Cloudflare-wired.
- Application login, user administration, roles, and sessions remain Apps Script-backed. Cloudflare Access and the Vercel server proxy protect preview admin transport but do not replace application identity and authorization parity.
- Google Drive binary operations remain correctly isolated to Apps Script, but no Cloudflare-facing media bridge contract, metadata reconciliation flow, or failure-recovery model exists yet.
- Import tooling is limited to public documents. No complete import, export, reconciliation, backup, restore, or incremental synchronization path exists for the remaining structured datasets.
- Production resources, production migration execution, production Worker deployment, production monitoring, and full rollback evidence are not present in the repository and must not be inferred.

M19 therefore classifies the system as **non-production preview proven, production parity incomplete**. M20 is only a future controlled production cutover preparation/gate after M19 acceptance and closure of its blocking gaps. M20 is not started by this document.

## Assessment Method And Evidence Labels

This assessment uses four labels:

- `VERIFIED`: directly supported by current code and tests, or by explicitly recorded operator-confirmed external evidence.
- `PARTIAL`: a foundation exists, but application wiring, contract parity, external smoke, or production evidence is incomplete.
- `GAP`: the required route, provider path, data workflow, or operational control is absent from the inspected repository.
- `UNKNOWN`: the repository does not contain enough evidence; an operator or external platform check is required.

Repository evidence takes precedence over milestone intent. External claims are treated as confirmed only where the operator has explicitly recorded them. The M13 and M14 documents define production gates but state that their production actions were not executed in those commits; current M19 instructions also confirm that no production D1 migration/import/write or production Worker deployment should be assumed. See [M13 Purpose](./m13-public-document-list-controlled-production-import-2026-06-11.md#purpose) and [M14 Purpose](./m14-public-document-list-production-worker-smoke-2026-06-11.md#purpose).

## Current Confirmed State From M16, M17, And M18

- `VERIFIED`: M16 defines Worker + D1 as the target structured-data backend and Apps Script as the target Google Drive media-file bridge. See [M16 New Direction](./m16-cloudflare-first-backend-reset-2026-06-13.md#new-direction) and [M16 Apps Script Future Role](./m16-cloudflare-first-backend-reset-2026-06-13.md#apps-script-future-role).
- `VERIFIED`: M17 implements D1-backed public routes for documents, home, content list/detail, search, programs, and visitor stats. The route registry marks all seven as implemented. See [M17 Route Contract Plan](./m17-cloudflare-core-public-read-batch-2026-06-13.md#route-contract-plan), the [Worker router](../../cloudflare/public-api/src/router.ts), and the [public-read route registry](../../cloudflare/public-api/src/routes/publicReadRegistry.ts).
- `VERIFIED EXTERNALLY`: The operator-confirmed M17 non-production grouped public-read smoke passed. See [M17-C Actual Preview Smoke Result](./m17-cloudflare-core-public-read-batch-2026-06-13.md#m17-c-actual-preview-smoke-result).
- `VERIFIED`: M18 implements preview-gated admin routes for content, document metadata, home sections, visitor daily stats, and partial admin snapshot readback. See [M18 Implemented Route Matrix](./m18-admin-d1-write-batch-migration-2026-06-16.md#implemented-route-matrix) and [adminWrite.ts](../../cloudflare/public-api/src/routes/adminWrite.ts).
- `VERIFIED EXTERNALLY`: The M18 non-production D1 migration, expected audit trigger set, and sanitized content write lifecycle smoke passed. See [M18 External Preview Acceptance Result](./m18-admin-d1-write-batch-migration-2026-06-16.md#external-preview-acceptance-result).
- `VERIFIED EXTERNALLY`: The preview Vercel server-proxy login returns HTTP 200 and the same-origin proxy can read `/api/admin/snapshot`. Repository support is in [handlers.mjs](../../server/adminProxy/handlers.mjs), [session.mjs](../../server/adminProxy/session.mjs), [adminProxySession.ts](../../src/services/adminProxySession.ts), and [cloudflareApi.ts](../../src/features/admin-write/cloudflareApi.ts).
- `VERIFIED`: Recent proxy fixes read Vercel runtime environment values, report only missing environment key names, support the installed bcryptjs default-export shape, and preserve secure cookie/session behavior. Regression coverage is in [handlers.test.mjs](../../server/adminProxy/handlers.test.mjs).
- `VERIFIED`: The committed Wrangler configuration remains placeholder-safe and explicitly disables preview admin writes in the production environment. No real infrastructure identifier is committed. See [wrangler.toml](../../cloudflare/public-api/wrangler.toml) and [M18 Preview Security Gate](./m18-admin-d1-write-batch-migration-2026-06-16.md#preview-security-gate).

## Production Safety Boundary

M19 has the following non-negotiable boundary:

- No production cutover in M19.
- No production D1 migration, import, or write in M19.
- No production Worker deployment in M19.
- No production Vercel environment mutation in M19.
- No Apps Script mutation in M19.
- No Google Drive media mutation in M19.
- No change to authentication, authorization, provider selection, cache keys, cache TTLs, UI, or routes in M19.
- No committed secrets, production URLs, preview or production Worker URLs, D1 ids, Cloudflare account ids, deployment ids, tokens, Google Drive URLs, Apps Script URLs, real record payloads, or personal data.

The real production domain remains on the legacy system. M15.2 remains deferred until the replacement system is complete, the domain can move safely, exact operator approval is recorded, and an approved monitoring window exists. See [M15 M15.1 Operator Decision](./m15-public-document-list-production-frontend-cutover-rollback-2026-06-11.md#m151-operator-decision).

## What Is Already Migrated

| Capability                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Assessment                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Public document Worker read contract       | D1 query, camelCase adapter, parity fixture, provider switch, and cache invariants exist in [publicDocuments.ts](../../cloudflare/public-api/src/routes/publicDocuments.ts), [publicDocumentsAdapter.ts](../../cloudflare/public-api/src/adapters/publicDocumentsAdapter.ts), [publicDocumentsParity.test.ts](../../cloudflare/public-api/test/publicDocumentsParity.test.ts), and [apiProviderSwitch.test.ts](../../src/features/public-documents/apiProviderSwitch.test.ts). | `VERIFIED` for repository contract and explicit preview selection; production data/cutover is not verified.     |
| Grouped public-read Worker foundation      | Seven D1-backed routes and minimum-shape tests exist in [router.ts](../../cloudflare/public-api/src/router.ts) and [publicReadCoreRoutes.test.ts](../../cloudflare/public-api/test/publicReadCoreRoutes.test.ts).                                                                                                                                                                                                                                                              | `VERIFIED` as a non-production API foundation; full React parity is incomplete.                                 |
| Structured content writes                  | Content create/update/publish/unpublish/archive, revision conflicts, public visibility, and atomic audit behavior are covered in [adminWrite.ts](../../cloudflare/public-api/src/routes/adminWrite.ts), [adminWriteRoutes.test.ts](../../cloudflare/public-api/test/adminWriteRoutes.test.ts), and M18 external smoke evidence.                                                                                                                                                | `VERIFIED` for non-production content lifecycle.                                                                |
| Structured document metadata writes        | Worker routes, deterministic public ordering, archive semantics, and local tests exist. Frontend save/delete wiring exists in [cms-documents/api.ts](../../src/features/cms-documents/api.ts).                                                                                                                                                                                                                                                                                 | `PARTIAL`: repository-tested, but no separate external document lifecycle evidence is recorded.                 |
| Home-section and visitor-daily-stat writes | Worker routes and local tests exist.                                                                                                                                                                                                                                                                                                                                                                                                                                           | `PARTIAL`: no current React provider integration and no dedicated external lifecycle result.                    |
| Preview admin transport security           | Cloudflare Access browser authentication, separate no-Origin smoke-token authentication, restricted CORS, and production-context blocking exist in [adminAccess.ts](../../cloudflare/public-api/src/auth/adminAccess.ts), [cors.ts](../../cloudflare/public-api/src/cors.ts), and [adminWriteRoutes.test.ts](../../cloudflare/public-api/test/adminWriteRoutes.test.ts).                                                                                                       | `VERIFIED` for preview gates.                                                                                   |
| Vercel same-origin admin proxy             | Signed HttpOnly cookie sessions, strict admin path forwarding, server-only smoke-token injection, and safe header filtering exist in [handlers.mjs](../../server/adminProxy/handlers.mjs) and [session.mjs](../../server/adminProxy/session.mjs).                                                                                                                                                                                                                              | `VERIFIED` in tests and externally for preview login/snapshot.                                                  |
| Atomic audit foundation                    | Sixteen parser-safe D1 triggers cover content, documents, home sections, and visitor daily stats.                                                                                                                                                                                                                                                                                                                                                                              | `VERIFIED` locally and externally for non-production migration presence; coverage is limited to those entities. |

## What Is Still Apps Script-Backed

Production remains Apps Script-backed for all live application traffic. In the replacement frontend, these paths still directly use [googleApi.ts](../../src/services/googleApi.ts):

- Public home snapshot through [public-home/api.ts](../../src/features/public-home/api.ts).
- Public content lists and content detail through [public-content/api.ts](../../src/features/public-content/api.ts).
- Public search index through [public-search/api.ts](../../src/features/public-search/api.ts).
- Public programs through [public-programs/api.ts](../../src/features/public-programs/api.ts).
- Site-view and content-view writes through [site-view/api.ts](../../src/features/site-view/api.ts) and [PublicContentDetailPage.tsx](../../src/public/pages/PublicContentDetailPage.tsx).
- Main login and session issuance through [auth.ts](../../src/services/auth.ts).
- User list, create/update, delete, reset, and authentication through [users.ts](../../src/services/users.ts).
- Site, homepage, display, visitor settings, menu, carousel, external services, events, integrations, and media APIs through their feature adapters and [googleApi.ts](../../src/services/googleApi.ts).

Cloudflare preview admin wiring currently covers only dashboard snapshot, content, and document structured operations through [cms-dashboard/api.ts](../../src/features/cms-dashboard/api.ts), [cms-content/api.ts](../../src/features/cms-content/api.ts), and [cms-documents/api.ts](../../src/features/cms-documents/api.ts).

## What Remains The Google Drive And Media-File Bridge

The target boundary remains: Apps Script performs Google Drive binary operations; D1 stores structured metadata and references. M18 intentionally left this boundary unchanged. See [M18 Apps Script Media-Only Boundary](./m18-admin-d1-write-batch-migration-2026-06-16.md#apps-script-media-only-boundary).

Current confirmed bridge responsibilities:

- Media upload and file creation.
- Media/file deletion when explicitly requested.
- Google Drive permissions and file ownership behavior.
- Google Docs body-file creation/deletion where used by legacy content.
- Returning sanitized metadata needed by structured records.

The React media adapter still exports Apps Script operations from [cms-media/api.ts](../../src/features/cms-media/api.ts), and tests explicitly keep media upload/delete on Apps Script in [adminWriteProvider.test.ts](../../src/features/admin-write/adminWriteProvider.test.ts).

The `media_assets` D1 table and row interface exist in [0001_public_read_schema.sql](../../cloudflare/public-api/migrations/0001_public_read_schema.sql) and [schema.ts](../../cloudflare/public-api/src/db/schema.ts), but no Worker media repository or route uses them. Schema presence is not migration completion.

## Public Read Parity Checklist

| Surface                                                      | Repository evidence                                                                                                                                                                                                                                                                                                                                    | Parity assessment                                                                                               | Required closure evidence                                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Documents                                                    | Exact public snapshot parity tests and explicit frontend provider switch exist.                                                                                                                                                                                                                                                                        | `PARTIAL`: contract parity is strong; production data freshness/count/order and live rollback are not verified. | Sanitized full-data reconciliation, production-safe import decision, direct Worker smoke, frontend smoke, and rollback evidence.                       |
| Public home                                                  | Worker returns `sections`, `featuredContent`, `featuredDocuments`, and `programs`; React expects settings, menu, carousel, external services, visitor stats, multiple categorized lists, events, media, and documents. Compare [publicHome.ts](../../cloudflare/public-api/src/contracts/publicHome.ts) with [PublicHomeSnapshot](../../src/types.ts). | `GAP`: not response-shape compatible and not frontend-wired.                                                    | Freeze an application-compatible contract or add an explicit frontend adapter, populate all required sources, and run page-level preview parity smoke. |
| Content list                                                 | Worker returns reduced `items` and `generatedAt`; React expects `kind`, page items, media, settings, and menu, with richer `ContentItem` fields. Compare [publicContent.ts](../../cloudflare/public-api/src/contracts/publicContent.ts) with [public-content/types.ts](../../src/features/public-content/types.ts).                                    | `GAP`: minimum Worker contract only; frontend remains Apps Script.                                              | Decide exact filtering/pagination semantics and prove React-compatible data for news, announcements, and blog.                                         |
| Content detail                                               | Worker returns a reduced public item; React detail uses the richer `ContentItem` model and still records views through Apps Script.                                                                                                                                                                                                                    | `GAP`: route exists, application contract and view-write behavior do not match.                                 | Compatible detail adapter/contract, media/body handling, safe 404 behavior, and content-view strategy.                                                 |
| Search                                                       | Worker performs a D1 query and returns `query`, reduced items, and timestamp; React currently loads a complete search index with settings/menu. Compare [publicSearch.ts](../../cloudflare/public-api/src/contracts/publicSearch.ts) with [public-search/types.ts](../../src/features/public-search/types.ts).                                         | `GAP`: behavior and shape differ; ranking/filter parity is unproven.                                            | Operator-approved search semantics, deterministic result tests, and browser preview comparison.                                                        |
| Programs                                                     | Worker returns reduced content items; React expects media, settings, and menu.                                                                                                                                                                                                                                                                         | `GAP`: route foundation exists but frontend contract and integration do not.                                    | Compatible program snapshot and department/program page smoke.                                                                                         |
| Visitor stats                                                | Worker returns only `total`, `today`, and timestamp; React expects the richer [VisitorStatsSettings](../../src/features/visitor-stats/types.ts).                                                                                                                                                                                                       | `GAP`: aggregation and response shape are incomplete.                                                           | Define authoritative counters, timezone/day boundaries, online-user semantics, and a compatible contract.                                              |
| Site-view write                                              | D1 schema has `visitor_events`, but no Worker route or repository uses it. React still calls Apps Script.                                                                                                                                                                                                                                              | `GAP`.                                                                                                          | Privacy-safe input contract, replay/throttle controls, retention policy, route tests, and non-production smoke.                                        |
| Content-view write                                           | D1 schema has content-view tables, but no Worker route or repository uses them.                                                                                                                                                                                                                                                                        | `GAP`.                                                                                                          | Idempotency/throttle, aggregation, retention, and public detail integration.                                                                           |
| Shared settings/menu/carousel/external services/events/media | Tables exist, but no public Worker routes expose these current React dependencies.                                                                                                                                                                                                                                                                     | `GAP`.                                                                                                          | Read repositories/contracts, data population, provider wiring, and parity tests.                                                                       |
| Public CORS and methods                                      | Public routes remain GET/OPTIONS-only with safe response helpers and tests.                                                                                                                                                                                                                                                                            | `VERIFIED` for current route surface.                                                                           | Preserve during future route expansion.                                                                                                                |
| Cache behavior                                               | Current frontend keys and TTLs are defined in [publicCmsCache.ts](../../src/services/publicCmsCache.ts) and feature cache modules. Only document-cache invariants have provider-switch tests.                                                                                                                                                          | `PARTIAL`.                                                                                                      | Prove provider changes preserve all existing keys, TTLs, invalidation, stale-data, and rollback behavior.                                              |

## Admin Write Parity Checklist

| Surface                              | Assessment                                                             | Evidence and gap                                                                                                                                                                                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content lifecycle                    | `VERIFIED` for non-production structured lifecycle.                    | Worker tests and external M18 content smoke cover create, revision update, publish, unpublish, public visibility, archive, audit, and cleanup.                                                                                                                                  |
| Document metadata lifecycle          | `PARTIAL`.                                                             | Worker/local tests and frontend save/delete wiring exist. External create/update/publish/unpublish/archive smoke is not recorded. Binary file lifecycle intentionally remains Apps Script.                                                                                      |
| Home sections                        | `PARTIAL`.                                                             | Worker CRUD exists, but no current frontend adapter uses it and no external lifecycle smoke is recorded.                                                                                                                                                                        |
| Visitor daily stats                  | `PARTIAL`.                                                             | Worker list/upsert/delete exists, but current settings UI remains Apps Script-backed and aggregation ownership is unresolved.                                                                                                                                                   |
| Admin snapshot                       | `PARTIAL`.                                                             | Worker returns content and documents; metrics, media, events, menu, carousel, and external services are empty arrays in [adminWrite.ts](../../cloudflare/public-api/src/routes/adminWrite.ts). Preview proxy snapshot transport is externally proven, not full snapshot parity. |
| Site/home/display settings           | `GAP`.                                                                 | D1 tables exist, but no admin Worker routes or frontend provider adapters exist.                                                                                                                                                                                                |
| Navigation/menu                      | `GAP`.                                                                 | D1 schema exists; frontend remains Apps Script-backed.                                                                                                                                                                                                                          |
| Carousel and external services       | `GAP`.                                                                 | D1 schemas exist; no Worker admin routes/provider wiring.                                                                                                                                                                                                                       |
| Calendar/events                      | `GAP`.                                                                 | D1 schema exists; no Worker admin routes/provider wiring.                                                                                                                                                                                                                       |
| Media metadata and binary operations | `GAP` for Cloudflare orchestration; Apps Script bridge remains active. | No Worker media route or D1 metadata repository is active.                                                                                                                                                                                                                      |
| Users and roles                      | `GAP`.                                                                 | No D1 user schema/Worker user route/provider migration.                                                                                                                                                                                                                         |
| Audit coverage                       | `PARTIAL`.                                                             | Atomic triggers cover only content, documents, home sections, and visitor daily stats. No audit model exists for the remaining future write-owned tables.                                                                                                                       |
| Production admin writes              | `GAP BY DESIGN`.                                                       | `hasProductionContext()` blocks the preview gate and committed production vars disable write/smoke access. A production authorization model has not been approved.                                                                                                              |

## Auth, Session, And Admin Access Parity Checklist

- `VERIFIED`: Main application login still uses Apps Script when configured, as shown in [auth.ts](../../src/services/auth.ts).
- `VERIFIED`: User CRUD and role checks remain in [users.ts](../../src/services/users.ts) and Apps Script API calls.
- `VERIFIED`: Direct preview browser admin requests can use Cloudflare Access JWT validation with issuer, audience, expiry, and optional email allowlist checks in [adminAccess.ts](../../cloudflare/public-api/src/auth/adminAccess.ts).
- `VERIFIED`: Non-browser preview smoke authentication is separate, rejects browser `Origin`, and remains uncommitted.
- `VERIFIED`: Preview server-proxy mode uses a same-origin signed HttpOnly cookie and server-only Worker credential. External login and snapshot readback passed.
- `PARTIAL`: [AuthContext.tsx](../../src/context/AuthContext.tsx) first establishes the existing application session and then establishes a proxy cookie when server-proxy mode is enabled. This is transport integration, not a unified identity store.
- `GAP`: Worker authorization has no application role/permission mapping equivalent to `admin`, `editor`, and `viewer`; allowed identity is not the same as resource-level authorization.
- `GAP`: No Cloudflare/D1 user lifecycle, password reset, account disablement, session revocation, role change propagation, or last-active-admin invariant exists.
- `UNKNOWN`: The intended production admin identity provider, Cloudflare Access production policy, MFA requirement, session lifetime, emergency access procedure, and operator ownership are external decisions.
- `UNKNOWN`: Whether the preview server proxy is temporary only or part of the intended production architecture. It must not be promoted implicitly.

## Media And File Handling Gap Checklist

- `VERIFIED`: Apps Script and Google Drive remain the only active binary upload/delete path.
- `VERIFIED`: M18 structured writes store references only and do not call Google Drive.
- `GAP`: No Worker media bridge endpoint delegates to Apps Script while storing authoritative D1 metadata.
- `GAP`: No active `media_assets` repository, public/admin media route, or frontend Cloudflare media provider exists.
- `GAP`: No atomic or compensating workflow handles Drive success plus D1 failure, D1 success plus Drive failure, retries, duplicate uploads, or orphan cleanup.
- `GAP`: No metadata reconciliation job verifies file id, URL, MIME type, size, permissions, and D1 references.
- `GAP`: No migration policy covers legacy Google Docs body files referenced by content records.
- `UNKNOWN`: Drive ownership, shared-drive location, quotas, permission model, retention/deletion policy, and service identity must be confirmed externally.
- `UNKNOWN`: The approved public file URL strategy and whether raw Drive URLs may appear in public API responses.

## Data Import, Export, And Sync Gap Checklist

- `VERIFIED`: Public-document import validation, dry-run manifest, approval-gated production runner, and smoke/cutover gates exist under [scripts](../../cloudflare/public-api/scripts). They do not prove that a production import occurred.
- `VERIFIED`: Current M19 instructions confirm no production D1 migration/import/write has occurred; M19 performs none.
- `GAP`: No equivalent controlled import exists for content, home sections, settings, menu, carousel, external services, events, visitor stats, media metadata, users, or analytics.
- `GAP`: No complete export format, backup artifact, restore rehearsal, or rollback import exists for D1.
- `GAP`: No cross-provider reconciliation report compares Apps Script and D1 counts, ids, ordering, status, revisions, and public shapes for all datasets.
- `GAP`: No incremental synchronization or change-capture process exists while Apps Script remains production source of truth.
- `GAP`: The `sync_runs` table is schema-only; repository search finds no runtime use outside schema-contract tests.
- `GAP`: No cutover freshness rule defines the final export time, write freeze, delta import, or ownership handoff.
- `UNKNOWN`: Real dataset inventory, row counts, duplicate ids/slugs, malformed records, missing files, and retention requirements require sanitized external analysis.

## D1 Schema And Migration Gap Checklist

- `VERIFIED`: Ordered migrations `0001` through `0004` define the current non-production schema and M18 audit hardening.
- `VERIFIED`: `contents`, `documents`, `public_home_sections`, and `visitor_daily_stats` have M18 write metadata and atomic audit triggers.
- `PARTIAL`: Tables already exist for media, settings, menu, carousel, services, events, visitor events, content views, and sync runs, but most are dormant schema contracts only.
- `GAP`: Future write-owned tables lack consistent revision, creator/updater, deletion, active-record, and audit conventions.
- `GAP`: No production D1 binding, production migration result, migration manifest, or production schema verification is committed or assumed.
- `GAP`: No production backup/restore rehearsal or forward-fix procedure exists.
- `GAP`: No documented data-retention and pruning migrations exist for visitor/content-view event tables.
- `UNKNOWN`: Capacity, indexing, query-plan, D1 limit, timezone, foreign-key/integrity, and large-dataset behavior need representative non-production testing.

## Worker Route And API Gap Checklist

Current public routes are enumerated in [router.ts](../../cloudflare/public-api/src/router.ts). Current admin routing is enumerated in [adminWrite.ts](../../cloudflare/public-api/src/routes/adminWrite.ts).

- `VERIFIED`: Health, seven public GET routes, admin content/documents/home sections/visitor stats/snapshot routes, safe 404/405 responses, and public/admin CORS separation exist.
- `GAP`: No site-view or content-view write route exists.
- `GAP`: No public settings, menu, carousel, external-services, events, or media route exists.
- `GAP`: No admin settings, menu, carousel, external-services, events, media, users, roles, or audit-log query route exists.
- `GAP`: M17 public contracts other than documents are not current frontend contracts.
- `GAP`: No unified API versioning/deprecation policy exists for transitioning from minimum M17 contracts to application-compatible contracts.
- `GAP`: [The Worker README](../../cloudflare/public-api/README.md) still presents M3 as current and lists several now-implemented M17 routes as deferred. The operational README must be reconciled before it can serve as a cutover runbook.
- `PARTIAL`: Error redaction is tested, but production logging, request correlation, rate limiting, abuse protection, and operational metrics are not repository-complete.
- `UNKNOWN`: Required pagination, maximum payload sizes, search limits, traffic profile, and latency targets need operator/product confirmation and representative tests.

## Vercel Frontend, Provider, And Environment Gap Checklist

- `VERIFIED`: `VITE_PUBLIC_API_PROVIDER` defaults to `apps-script` in [publicApiProvider.ts](../../src/config/publicApiProvider.ts).
- `VERIFIED`: Only [public-documents/api.ts](../../src/features/public-documents/api.ts) reads that public provider and calls Cloudflare.
- `GAP`: Public home, content, search, programs, visitor stats, site-view, and content-view modules do not use a Cloudflare provider path.
- `VERIFIED`: `VITE_ADMIN_WRITE_PROVIDER` defaults to Apps Script and selects Cloudflare only in explicit preview migration mode with a valid Access or same-origin proxy target. See [adminWriteProvider.ts](../../src/config/adminWriteProvider.ts).
- `PARTIAL`: Cloudflare admin provider wiring covers snapshot, content, and documents only.
- `GAP`: No frontend adapter exists for Worker home-section and visitor-daily-stat admin routes.
- `GAP`: M15 cutover automation is scoped only to `public-document-list`; it is not a grouped public/admin cutover gate. See [M15 Scope](./m15-public-document-list-production-frontend-cutover-rollback-2026-06-11.md#scope).
- `GAP`: No production environment matrix defines which provider values switch each completed surface while leaving media on Apps Script.
- `UNKNOWN`: Production Vercel project ownership, environment access, deploy promotion procedure, and exact non-secret origins are external and must remain outside git.

## Rollback And Observability Gap Checklist

- `VERIFIED`: Preview provider rollback is environment-based and returns public documents/admin structured calls to Apps Script.
- `VERIFIED`: Apps Script remains available; no production cutover has removed it.
- `VERIFIED`: M17/M18 smoke runners redact output and fail on unsafe leakage or lifecycle failures.
- `VERIFIED`: M18 audit triggers provide entity mutation evidence for four D1 tables.
- `GAP`: No full-application rollback drill covers all public reads, admin writes, auth, media bridge, caches, and domain routing.
- `GAP`: No automated dual-read parity monitor compares live Apps Script output with Worker output.
- `GAP`: No production dashboards, alerts, SLOs, error-budget policy, D1 health/latency monitoring, or bridge-failure alerting are documented.
- `GAP`: No production D1 backup/restore evidence or rollback data reconciliation exists.
- `GAP`: No post-cutover write-reversal policy defines what happens to D1 writes if traffic returns to Apps Script.
- `UNKNOWN`: Required RTO, RPO, monitoring window length, on-call owner, rollback authority, and acceptable parity tolerances require operator approval.

## Known External Requirements

The following must be provisioned, approved, or verified outside git before a future production gate:

- Confirmed production Cloudflare account/project ownership and D1 resource ownership.
- Confirmed production Worker routing/domain plan without committing the URL.
- Confirmed Vercel production project/environment access and deploy promotion authority.
- Approved production admin identity and authorization model, including Cloudflare Access policy if selected.
- Approved Google Drive bridge service identity, permissions, quotas, and operational owner.
- Sanitized source-data inventory and reconciliation results for every structured dataset.
- Production backup/restore plan and evidence from a representative non-production rehearsal.
- Approved DNS/domain cutover plan that preserves the legacy live system until the replacement is complete.
- Approved monitoring window, support owner, rollback authority, and incident communication path.
- Exact cutover and rollback approvals. These values must remain outside git.

## Unknowns Requiring Operator Confirmation

| Unknown                                                             | Why it blocks readiness                                                 | How to verify safely                                                                             |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Complete legacy dataset inventory and counts                        | Import scope and parity tolerance cannot be calculated.                 | Produce a redacted count/schema report outside git for each Apps Script resource.                |
| Which current CMS screens are required for first production release | Admin parity may otherwise omit an operationally critical screen.       | Operator signs off a screen/action inventory mapped to frontend feature adapters.                |
| Final public API contract strategy                                  | M17 minimum contracts differ from React contracts.                      | Approve preserve-shape adapters versus coordinated frontend contract changes, then freeze tests. |
| Search semantics                                                    | Current index-based frontend and Worker query behavior differ.          | Approve ranking, filters, result limits, and Thai-language expectations using sanitized cases.   |
| Visitor and content analytics semantics                             | Counters, online users, timezone, privacy, and retention are undefined. | Approve data definitions and privacy/retention policy before implementing writes.                |
| Production admin identity/RBAC                                      | Preview Access/allowlist behavior is not full role parity.              | Approve identity provider, roles, permissions, MFA, session, revocation, and break-glass policy. |
| Server-proxy production role                                        | Preview success does not authorize production use.                      | Decide temporary preview-only versus approved production component through security review.      |
| Media bridge ownership and recovery                                 | Cross-system failures can create stale metadata or orphan files.        | Confirm Drive owner, quotas, permissions, retry/idempotency, and reconciliation process.         |
| Production D1/Worker readiness                                      | No production binding, deploy, migration, or write may be assumed.      | Run a separately approved, redacted provisioning and readiness record outside M19.               |
| Cutover RTO/RPO and monitoring                                      | Rollback cannot be objectively gated without thresholds.                | Operator approves numeric targets and an observation/rollback window.                            |

## Proposed M19 Acceptance Criteria

M19 can be accepted when the operator reviews this assessment and confirms all of the following:

- [ ] Every current public and admin Apps Script action is classified as migrated, bridge-only, explicitly deferred, or blocking.
- [ ] Each `UNKNOWN` has an owner, verification method, and decision date outside committed secrets/infrastructure data.
- [ ] The application-compatible contract strategy is approved for home, content, search, programs, and visitor stats.
- [ ] Required first-release admin screens/actions are identified, including explicit treatment of settings, navigation, carousel, services, events, media, and users.
- [ ] Auth/session/RBAC ownership is approved; preview transport security is not mistaken for production identity parity.
- [ ] The Google Drive media bridge contract, metadata ownership, and compensation/reconciliation behavior are approved.
- [ ] Full structured-data import/export/reconciliation and freshness requirements are approved.
- [ ] D1 production migration, backup, restore, retention, and forward-fix requirements are approved without executing them in M19.
- [ ] Full-system rollback and observability criteria have measurable owners and thresholds.
- [ ] Remediation work is prioritized and scoped without weakening Apps Script fallback.
- [ ] No production cutover, production D1 mutation, production Worker deployment, Apps Script mutation, or Google Drive mutation occurred in M19.
- [ ] No secret, production URL, Worker URL, D1 id, account id, token, or real record payload is committed.

M19 documentation completion is not itself proof that these operator acceptance items are satisfied.

## Proposed M20 Gate Conditions

M20 is a future controlled production cutover preparation/gate only. It is not started by M19 and must not become an implementation catch-all.

Before M20 may start:

- M19 acceptance is explicitly recorded by the operator.
- Blocking contract and frontend-provider gaps are closed and verified in non-production.
- Required admin structured-write parity is closed or explicitly deferred with an approved Apps Script fallback boundary.
- Production auth/session/RBAC and the media bridge architecture are security-reviewed and approved.
- All in-scope structured datasets have validated import, reconciliation, freshness, and rollback procedures.
- Representative non-production migration, browser, API, admin, media-bridge, backup, restore, and rollback smokes pass with redacted evidence.
- Production resources and access are externally confirmed without committing identifiers or secrets.
- Production monitoring, RTO/RPO, rollback authority, and observation window are approved.
- M15.2 domain-management constraints are resolved and exact execute approval is available.

If any condition is missing, M20 remains blocked. Remediation may be scoped separately, but this assessment does not invent or start additional milestones.

## Explicit Non-Goals

M19 does not:

- cut over production frontend traffic
- provision or deploy a production Worker
- create, migrate, import, seed, query, or write production D1
- mutate Vercel production environment values
- change Apps Script or Google Drive
- import real data or commit real records
- change public/admin API behavior
- change provider defaults or frontend runtime behavior
- change auth, sessions, roles, or access policies
- add media upload/delete behavior
- change UI, routes, cache keys, or cache TTLs
- weaken M15 production URL, approval, or rollback gates
- declare M20 started

## Recommended Operator Action

Review and sign off the M19 acceptance checklist, beginning with two decisions that unblock most downstream work: the application-compatible public contract strategy and the required first-release admin action inventory. Assign an owner and evidence method to every `UNKNOWN`. Keep M20 blocked until the resulting remediation work and non-production parity evidence are complete.
