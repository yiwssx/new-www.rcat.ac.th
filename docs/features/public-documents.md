# Public Documents / เอกสารเผยแพร่

## Purpose

Public Documents adds a dedicated CMS module for downloadable public files such as policies, ITA documents, plans, reports, and forms. It replaces the old homepage-only heuristic that inferred documents from published content pages with document-related keywords.

Published document metadata is now structured data owned by Cloudflare Worker + D1. Existing content pages are not deleted or converted automatically.

Current status: cleanup completed; preview field verification in progress. M20 production cutover remains gated.

## Admin Workflow

1. Sign in to the CMS.
2. Open `/admin/documents` from the เอกสารเผยแพร่ menu item.
3. Create or edit a document with:
   - title
   - description
   - category
   - fileUrl
   - fileName
   - mediaId
   - publishedAt
   - status
   - order
   - pinned
4. Save as `draft` to keep it private.
5. Save as `published` to show it publicly.
6. Use `pinned` and `order` to control homepage/public ordering.
7. Delete archives/removes the D1 document metadata record and clears public caches.

## Public Display Behavior

Published documents are returned through `public-document-list` and included in `public-home.documentItems`.

The homepage keeps the existing `DocumentListCard` visual design. Managed documents link directly to `fileUrl`. Legacy keyword-derived content pages still link to `/content/:slug` only when the D1 `documents` table has no published documents.

Draft documents are excluded from all public responses.

A full public `/documents` archive route is not included yet. Add it as a follow-up when the school wants a standalone document index beyond the homepage card.

## D1 Schema

Table: `documents`

Fields:

| Field          | Purpose                             |
| -------------- | ----------------------------------- |
| `id`           | Stable document id                  |
| `title`        | Public document title               |
| `description`  | Optional public summary             |
| `category`     | Public category label               |
| `file_url`     | HTTPS file URL                      |
| `file_name`    | Optional display/download file name |
| `media_id`     | Optional linked media id            |
| `published_at` | Public publish timestamp            |
| `status`       | `draft` or `published`              |
| `sort_order`   | Ascending display order             |
| `pinned`       | `TRUE`/`FALSE` pinned flag          |
| `updated_at`   | Last update timestamp               |

## Sorting Rules

Public documents sort by:

1. pinned first
2. order ascending
3. publishedAt descending

## Cache Behavior

Cloudflare Worker/D1 returns the public document list. Frontend public document cache uses `rcat.cms.public.document-list`, and the shared public CMS invalidation helper clears it after document mutations.

Saving or deleting a document invalidates:

- public snapshot cache
- public home cache
- public document list cache
- other public list/search caches cleared by the shared public CMS invalidation helper

Site view tracking does not invalidate document cache.

The frontend also has a local public document list cache key: `rcat.cms.public.document-list`, and `clearPublicCmsCache()` clears it.

## Migration From Keyword-Derived Pages

Existing keyword-derived content pages remain untouched.

Migration path:

1. Create matching records in `/admin/documents`.
2. Set each document to `published`.
3. Confirm the homepage document card uses the managed document links.
4. Keep or archive the old content pages manually as editorial policy requires.

If the D1 `documents` table has no published records, the homepage temporarily falls back to the old keyword-derived page list.

## Deployment And Verification

1. Confirm the approved Cloudflare Worker/D1 environment is configured for public and admin structured data.
2. In the CMS, create a test draft document and verify it does not appear publicly.
3. Publish the test document and verify it appears on the homepage document card and public documents response.
4. Delete/archive the test document and verify public caches update.
5. Confirm media/file bytes, if any, still use the Apps Script media bridge and Google Drive storage.

Apps Script deployment is not required for document metadata changes unless the separate media/file bridge code changed.
