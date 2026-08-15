-- P5A production data-integrity sentinel.
-- Read-only. Identifies only the exact local/dev fixtures from public-read-core.seed.sql.

SELECT 'public_home_sections' AS source, id AS fixture_key
FROM public_home_sections
WHERE id = 'sample-public-read-home-section-001'
UNION ALL
SELECT 'documents' AS source, id AS fixture_key
FROM documents
WHERE id = 'sample-public-read-document-001'
UNION ALL
SELECT 'contents' AS source, id AS fixture_key
FROM contents
WHERE id = 'sample-public-read-content-001'
UNION ALL
SELECT 'contents' AS source, id AS fixture_key
FROM contents
WHERE id = 'sample-public-read-program-001'
UNION ALL
SELECT 'visitor_daily_stats' AS source, day AS fixture_key
FROM visitor_daily_stats
WHERE day = '2026-06-13'
  AND total_views = 12
  AND unique_visitors = 5
  AND online_users = 2
  AND updated_at = '2026-06-13T00:00:00.000Z'
UNION ALL
SELECT 'visitor_daily_stats' AS source, day AS fixture_key
FROM visitor_daily_stats
WHERE day = '2026-01-01'
  AND total_views = 8
  AND unique_visitors = 4
  AND online_users = 0
  AND updated_at = '2026-01-01T00:00:00.000Z';
