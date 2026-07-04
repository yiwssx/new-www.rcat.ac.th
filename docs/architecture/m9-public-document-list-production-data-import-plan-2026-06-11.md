# M9 Public Document List Production Data Import Plan - 2026-06-11

> Historical note, 2026-07-04: This checkpoint describes a previous public-document import planning state and is not the current runtime source of truth. Current runtime ownership has advanced: structured public/admin data uses Cloudflare Worker + D1, Apps Script is retained only for the Vercel-proxied Google Drive media/file bridge, cleanup is completed, preview field verification is in progress, and M20 production cutover remains gated.

Status: production data import planning only. No production import, migration, deployment, or cutover is executed.

## Purpose

M9 prepares a safe future production D1 data import plan for `public-document-list`.

Apps Script remains the production source of truth and the default frontend provider. Production D1 remains non-authoritative until a separately approved cutover is planned, executed, verified, and recorded.

This checkpoint does not run a production import, run a production migration, deploy a production Worker, set production Vercel env, or switch frontend traffic to Cloudflare.

## Source of Truth

The current source of truth remains Apps Script and the existing CMS data flow.

M9 does not modify Apps Script, fetch live production data, export production records, or commit live school content. Real data export/import evidence must stay outside git or be recorded in redacted form.

Future production import work must treat Apps Script as authoritative until a separate cutover approval explicitly changes the production serving path for `public-document-list`.

## Data Mapping

D1 snake_case maps to public camelCase. `sort_order` maps to public `order`. Only published/active records should be served. Internal fields such as `status` must not leak into the public response.

| Source Meaning         | Public Contract Field | D1 Column      | Notes                                                         |
| ---------------------- | --------------------- | -------------- | ------------------------------------------------------------- |
| Stable document id     | `id`                  | `id`           | Required and stable across exports.                           |
| Display title          | `title`               | `title`        | Required public title.                                        |
| Public summary         | `description`         | `description`  | Optional text should be sanitized.                            |
| Public grouping        | `category`            | `category`     | Preserve current category semantics.                          |
| Approved file link     | `fileUrl`             | `file_url`     | Must be an approved production file URL before import.        |
| File display name      | `fileName`            | `file_name`    | Preserve user-facing file name.                               |
| Related media id       | `mediaId`             | `media_id`     | Optional; must not expose private media metadata.             |
| Published timestamp    | `publishedAt`         | `published_at` | Normalize to ISO string.                                      |
| Manual sort position   | `order`               | `sort_order`   | Numeric ascending after pinned records.                       |
| Featured flag          | `pinned`              | `pinned`       | Boolean-compatible value.                                     |
| Update timestamp       | `updatedAt`           | `updated_at`   | Normalize to ISO string.                                      |
| Internal publish state | Not public            | `status`       | Internal only; do not expose in `PublicDocumentListSnapshot`. |

The future Worker response must continue to match `PublicDocumentListSnapshot` with only public fields.

## Import Strategy Draft

Draft only. Do not execute in M9.

Future-only import steps after separate approval:

- Export approved document data from the source of truth.
- Validate required fields.
- Normalize dates to ISO strings.
- Sanitize text fields.
- Verify file URLs are approved.
- Transform records to D1 column shape.
- Import into production D1 only after approval.
- Run direct Worker smoke.
- Compare contract parity.
- Keep rollback option available.

No import command, migration command, seed command, or production deploy command is run by M9.

## Validation Rules

- `id` is required and stable.
- `title` is required.
- `fileUrl` is required only if the source record requires a downloadable file.
- `publishedAt` and `updatedAt` must be valid ISO strings.
- `order` / `sort_order` must be numeric.
- `pinned` must be boolean-compatible.
- `status` must be an allowed internal value only.
- Public response must contain no extra public fields.
- Public response must contain no snake_case fields.
- Public response must contain no internal fields.
- Response shape must match `PublicDocumentListSnapshot`.

## Parity Evidence Template

Use this redacted template for a future approved production import record:

- Source export timestamp:
- Source record count:
- D1 imported record count:
- Worker returned item count:
- Sample IDs checked:
- Contract validation result:
- Sorting validation result:
- Pinned ordering validation result:
- Date normalization result:
- Field leakage check result:
- Browser UI smoke result:
- Rollback data strategy result:

Do not include full D1 ids, tokens, account ids, secrets, query strings, real file storage URLs, private school records, or sensitive production data.

## Sorting / Ordering Expectations

The public list should be ordered by pinned first, then deterministic secondary fields:

1. `pinned` first.
2. `sort_order` ascending.
3. `published_at` descending.
4. `updated_at` descending.

The parity check must compare this ordering against the Apps Script source output before any production provider switch is considered.

## Rollback Data Strategy

- Keep Apps Script as the authoritative source.
- Production frontend can return to Apps Script by removing the Cloudflare provider env or setting the provider back to Apps Script.
- D1 imported data can remain unused if rollback occurs.
- No destructive production D1 cleanup is performed in M9.
- Future cleanup requires separate approval.

## No-Go Conditions

Any condition below blocks a future production import or cutover:

- Unapproved source data.
- Real Google Drive URLs committed.
- Production D1 id committed.
- Field mismatch.
- Record count mismatch without explanation.
- Invalid dates.
- Leaked internal fields.
- Response does not match `PublicDocumentListSnapshot`.
- Sorting mismatch.
- Failed rollback strategy.
- Any Apps Script change.
- Any `src/services/googleApi.ts` change.
- Any UI, route, cache key, or cache TTL change.
- Any endpoint beyond `public-document-list`.
- Any admin, auth, or media migration.

## Production Safety Confirmation

M9 does not:

- Run production import.
- Run production migration.
- Deploy production Worker.
- Set production Vercel env.
- Cut over production.
- Commit real production data.
- Commit real Google Drive URLs.
- Commit D1 ids, secrets, or tokens.
- Change Apps Script.
- Change `src/services/googleApi.ts`.
- Change UI, routes, cache keys, or cache TTL.
- Include endpoints beyond `public-document-list`.

Production identifiers, production source exports, and production import evidence remain outside git unless separately approved and safely redacted.
