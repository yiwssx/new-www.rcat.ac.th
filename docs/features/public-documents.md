# Public Documents / เอกสารเผยแพร่

## Purpose

Public Documents adds a dedicated CMS module for downloadable public files such as policies, ITA documents, plans, reports, and forms. It replaces the old homepage-only heuristic that inferred documents from published content pages with document-related keywords.

The Documents sheet is now the source of truth when it has published records. Existing content pages are not deleted or converted automatically.

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
7. Delete removes the row from the Documents sheet and clears public caches.

## Public Display Behavior

Published documents are returned through `public-document-list` and included in `public-home.documentItems`.

The homepage keeps the existing `DocumentListCard` visual design. Managed documents link directly to `fileUrl`. Legacy keyword-derived content pages still link to `/content/:slug` only when the Documents sheet has no published documents.

Draft documents are excluded from all public responses.

A full public `/documents` archive route is not included yet. Add it as a follow-up when the school wants a standalone document index beyond the homepage card.

## Sheet Schema

Sheet name: `Documents`

Headers:

| Field         | Purpose                             |
| ------------- | ----------------------------------- |
| `id`          | Stable document id                  |
| `title`       | Public document title               |
| `description` | Optional public summary             |
| `category`    | Public category label               |
| `fileUrl`     | HTTPS file URL                      |
| `fileName`    | Optional display/download file name |
| `mediaId`     | Optional linked media id            |
| `publishedAt` | Public publish timestamp            |
| `status`      | `draft` or `published`              |
| `order`       | Ascending display order             |
| `pinned`      | `TRUE`/`FALSE` pinned flag          |
| `updatedAt`   | Last update timestamp               |

## Sorting Rules

Public documents sort by:

1. pinned first
2. order ascending
3. publishedAt descending

## Cache Behavior

Apps Script caches `public-document-list` separately at `cms:public:document-list:v1`.

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

If the Documents sheet has no published records, the homepage temporarily falls back to the old keyword-derived page list.

## Apps Script Deployment Steps

1. Run `setupCmsBackend()` once after deploying the new Apps Script code so the `Documents` sheet is created with the new headers.
2. Deploy the Apps Script web app as a new version.
3. Confirm the web app URL still matches `VITE_GOOGLE_APPS_SCRIPT_URL`.
4. In the CMS, create a test draft document and verify it does not appear publicly.
5. Publish the test document and verify it appears on the homepage document card and via `?resource=public-document-list`.
