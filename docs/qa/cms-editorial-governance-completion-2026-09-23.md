# CMS editorial governance completion — 2026-09-23

This change set closes the remaining CMS/editorial follow-up work identified after the Tiptap and content-lifecycle rollout.

## B2 runtime incident feed

B2 was re-audited rather than reimplemented. The existing implementation is already present and production-governed:

- public runtime incident ingestion with origin/rate-limit enforcement;
- sanitized, allowlisted incident fields only;
- five-minute aggregation buckets;
- seven-day retention and latest-2,000-row bound;
- authenticated `dashboard.read` operator feed;
- regression coverage for path redaction, request IDs, 5xx/network filtering, bounded storage, untrusted origins, and the admin authentication boundary.

No duplicate B2 storage, route, or workflow was added.

## Editorial workflow

- explicit Draft → Review submission;
- explicit Review → Draft return;
- optimistic revision checking;
- readiness checks before entering Review;
- audit log entries for submit/return transitions;
- published/scheduled content remains under the existing publish/unpublish flow.

## Trash and restore

- Admin trash view for soft-deleted content;
- restore uses the canonical delete revision snapshot to recover the original slug;
- active-slug collision protection;
- optimistic revision checking;
- restored content always returns as Draft;
- audit log entry for restore.

## Content health

The Admin content workspace reports:

- missing summary/body/owner;
- incomplete SEO for published/scheduled content;
- missing referenced media;
- referenced images without alt text;
- Draft/Review content stale for more than 30 days.

## Rich-text regressions

Coverage includes:

- persisted `RCAT_BLOCKS_V1` rich-text round trips;
- Thai text and country-flag emoji SSR;
- safe/unsafe link rendering;
- semantic no-JS heading/list/table rendering;
- raw-HTML escaping;
- normalization of headings, alignment, ordered-list start, and colors;
- dropping unsupported nodes and marks.
