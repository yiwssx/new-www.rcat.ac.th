-- P5A exact cleanup for fixtures from public-read-core.seed.sql.
-- This file intentionally contains no wildcard deletes and no production-wide reset.

BEGIN TRANSACTION;

DELETE FROM public_home_sections
WHERE id = 'sample-public-read-home-section-001'
  AND section_key = 'intro'
  AND title = 'Sample preview intro'
  AND summary = 'Fake local-only public home section.'
  AND href = 'https://preview.example.test/intro'
  AND updated_at = '2026-06-13T00:00:00.000Z';

DELETE FROM documents
WHERE id = 'sample-public-read-document-001'
  AND title = 'Sample preview handbook'
  AND description = 'Fake local-only public document.'
  AND file_url = 'https://files.example.test/public/preview-handbook.pdf'
  AND file_name = 'preview-handbook.pdf'
  AND status = 'published'
  AND updated_at = '2026-06-13T00:00:00.000Z';

DELETE FROM contents
WHERE id = 'sample-public-read-content-001'
  AND slug = 'sample-preview-news'
  AND type = 'news'
  AND title = 'Sample preview news'
  AND summary = 'Fake local-only public content summary.'
  AND canonical_url = 'https://preview.example.test/news/sample-preview-news'
  AND updated_at = '2026-06-13T00:00:00.000Z';

DELETE FROM contents
WHERE id = 'sample-public-read-program-001'
  AND slug = 'sample-preview-program'
  AND type = 'program'
  AND title = 'Sample preview program'
  AND summary = 'Fake local-only program summary.'
  AND canonical_url = 'https://preview.example.test/programs/sample-preview-program'
  AND updated_at = '2026-06-13T00:00:00.000Z';

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

COMMIT;
