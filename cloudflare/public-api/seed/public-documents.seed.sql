-- M2.2 fake local-only public documents seed.
-- This file is for local D1 development only. It must never contain real
-- school data, Apps Script URLs, Google Drive URLs, or production records.

DELETE FROM documents WHERE id LIKE 'sample-%';

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
    'sample-public-document-001',
    'Sample public handbook',
    'Fake local-only row for D1 seed safety.',
    'sample',
    'https://files.example.test/rcat/sample-public-handbook.pdf',
    'sample-public-handbook.pdf',
    'sample-media-001',
    '2026-01-01T00:00:00.000Z',
    'published',
    10,
    1,
    '2026-01-01T00:00:00.000Z'
  ),
  (
    'sample-public-document-002',
    'Sample meeting notice',
    'Second fake local-only row for ordering checks.',
    'sample',
    'https://files.example.test/rcat/sample-meeting-notice.pdf',
    'sample-meeting-notice.pdf',
    '',
    '2026-01-02T00:00:00.000Z',
    'published',
    20,
    0,
    '2026-01-02T00:00:00.000Z'
  );
