-- M5 fake preview-only public documents seed.
-- This file is for non-production D1 preview testing only. It must never
-- contain real school data, Apps Script URLs, Google Drive URLs, or real files.

DELETE FROM documents WHERE id LIKE 'preview-%';

INSERT INTO documents (
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
    'preview-public-document-001',
    'Preview public handbook',
    'Fake preview-only row for HTTPS Worker provider smoke tests.',
    'preview',
    'https://files.example.test/preview/public-handbook.pdf',
    'public-handbook.pdf',
    'preview-media-001',
    '2026-05-27T00:00:00.000Z',
    'published',
    10,
    1,
    '2026-05-27T00:00:00.000Z'
  ),
  (
    'preview-public-document-002',
    'Preview meeting notice',
    'Second fake preview-only row for public document ordering checks.',
    'preview',
    'https://files.example.test/preview/meeting-notice.pdf',
    'meeting-notice.pdf',
    '',
    '2026-05-28T00:00:00.000Z',
    'published',
    20,
    0,
    '2026-05-28T00:00:00.000Z'
  );
