-- M17-B sanitized public-read core seed for local/dev preview only.
-- Fake sample data only. Do not use for production import.

DELETE FROM public_home_sections WHERE id LIKE 'sample-public-read-%';
DELETE FROM documents WHERE id LIKE 'sample-public-read-%';
DELETE FROM contents WHERE id LIKE 'sample-public-read-%';
DELETE FROM visitor_daily_stats WHERE day IN ('2026-01-01', '2026-06-13');

INSERT OR REPLACE INTO public_home_sections (
  id,
  section_key,
  title,
  summary,
  href,
  sort_order,
  enabled,
  updated_at
) VALUES
  (
    'sample-public-read-home-section-001',
    'intro',
    'Sample preview intro',
    'Fake local-only public home section.',
    'https://preview.example.test/intro',
    1,
    1,
    '2026-06-13T00:00:00.000Z'
  );

INSERT OR REPLACE INTO documents (
  id,
  title,
  description,
  category,
  file_url,
  file_name,
  media_id,
  published_at,
  status,
  sort_order,
  pinned,
  updated_at
) VALUES
  (
    'sample-public-read-document-001',
    'Sample preview handbook',
    'Fake local-only public document.',
    'sample',
    'https://files.example.test/public/preview-handbook.pdf',
    'preview-handbook.pdf',
    'sample-public-read-media-001',
    '2026-06-13T00:00:00.000Z',
    'published',
    1,
    1,
    '2026-06-13T00:00:00.000Z'
  );

INSERT OR REPLACE INTO contents (
  id,
  slug,
  type,
  status,
  title,
  summary,
  body_snapshot,
  category,
  tags_json,
  seo_title,
  seo_description,
  canonical_url,
  featured,
  reading_minutes,
  template,
  body_doc_id,
  body_doc_url,
  featured_media_id,
  media_ids_json,
  view_count,
  last_viewed_at,
  updated_at,
  publish_at
) VALUES
  (
    'sample-public-read-content-001',
    'sample-preview-news',
    'news',
    'published',
    'Sample preview news',
    'Fake local-only public content summary.',
    'Fake local-only public content body.',
    'news',
    '["sample"]',
    '',
    '',
    'https://preview.example.test/news/sample-preview-news',
    1,
    2,
    'article',
    '',
    '',
    '',
    '[]',
    0,
    '',
    '2026-06-13T00:00:00.000Z',
    '2026-06-13T00:00:00.000Z'
  ),
  (
    'sample-public-read-program-001',
    'sample-preview-program',
    'program',
    'published',
    'Sample preview program',
    'Fake local-only program summary.',
    'Fake local-only program body.',
    'program',
    '["sample"]',
    '',
    '',
    'https://preview.example.test/programs/sample-preview-program',
    1,
    2,
    'program',
    '',
    '',
    '',
    '[]',
    0,
    '',
    '2026-06-13T00:00:00.000Z',
    '2026-06-13T00:00:00.000Z'
  );

INSERT OR REPLACE INTO visitor_daily_stats (
  day,
  total_views,
  unique_visitors,
  online_users,
  updated_at
) VALUES
  ('2026-06-13', 12, 5, 2, '2026-06-13T00:00:00.000Z'),
  ('2026-01-01', 8, 4, 0, '2026-01-01T00:00:00.000Z');
