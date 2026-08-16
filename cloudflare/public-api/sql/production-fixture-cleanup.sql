-- P5A exact cleanup for fixtures in tables that exist before M17-B.
-- This file intentionally contains no wildcard deletes and no production-wide reset.
-- D1 remote --file execution rejects explicit SQL transaction control; Wrangler handles rollback on failed imports.
-- Namespaced sample-public-read-* IDs are the fixture identity used by the production sentinel.
-- Mutable fixture fields may drift after the seed is exercised, so documents/contents are removed only by those reserved exact IDs.

DELETE FROM documents
WHERE id = 'sample-public-read-document-001';

DELETE FROM contents
WHERE id = 'sample-public-read-content-001';

DELETE FROM contents
WHERE id = 'sample-public-read-program-001';

DELETE FROM visitor_daily_stats
WHERE day = '2026-06-13'
  AND total_views = 12
  AND unique_visitors = 5
  AND online_users = 2
  AND updated_at = '2026-06-13T00:00:00.000Z';

DELETE FROM visitor_daily_stats
WHERE day = '2026-01-01'
  AND total_views = 8
  AND unique_visitors = 4
  AND online_users = 0
  AND updated_at = '2026-01-01T00:00:00.000Z';
