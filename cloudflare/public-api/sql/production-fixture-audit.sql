-- P5A production data-integrity sentinel for tables that exist before M17-B.
-- Read-only. Identifies only the exact local/dev fixtures from public-read-core.seed.sql.
-- Uses one SELECT shape so the remote D1 query endpoint does not need a compound SELECT.

SELECT
  CASE CAST(candidate.value AS INTEGER)
    WHEN 0 THEN 'documents'
    WHEN 1 THEN 'contents'
    WHEN 2 THEN 'contents'
    WHEN 3 THEN 'visitor_daily_stats'
    WHEN 4 THEN 'visitor_daily_stats'
  END AS source,
  CASE CAST(candidate.value AS INTEGER)
    WHEN 0 THEN 'sample-public-read-document-001'
    WHEN 1 THEN 'sample-public-read-content-001'
    WHEN 2 THEN 'sample-public-read-program-001'
    WHEN 3 THEN '2026-06-13'
    WHEN 4 THEN '2026-01-01'
  END AS fixture_key
FROM json_each('[0,1,2,3,4]') AS candidate
WHERE CASE CAST(candidate.value AS INTEGER)
  WHEN 0 THEN EXISTS (
    SELECT 1
    FROM documents
    WHERE id = 'sample-public-read-document-001'
  )
  WHEN 1 THEN EXISTS (
    SELECT 1
    FROM contents
    WHERE id = 'sample-public-read-content-001'
  )
  WHEN 2 THEN EXISTS (
    SELECT 1
    FROM contents
    WHERE id = 'sample-public-read-program-001'
  )
  WHEN 3 THEN EXISTS (
    SELECT 1
    FROM visitor_daily_stats
    WHERE day = '2026-06-13'
      AND total_views = 12
      AND unique_visitors = 5
      AND online_users = 2
      AND updated_at = '2026-06-13T00:00:00.000Z'
  )
  WHEN 4 THEN EXISTS (
    SELECT 1
    FROM visitor_daily_stats
    WHERE day = '2026-01-01'
      AND total_views = 8
      AND unique_visitors = 4
      AND online_users = 0
      AND updated_at = '2026-01-01T00:00:00.000Z'
  )
  ELSE 0
END = 1;
