-- P5A optional exact cleanup for the M17-B public_home_sections fixture.
-- Run only after confirming public_home_sections exists.

BEGIN TRANSACTION;

DELETE FROM public_home_sections
WHERE id = 'sample-public-read-home-section-001'
  AND section_key = 'intro'
  AND title = 'Sample preview intro'
  AND summary = 'Fake local-only public home section.'
  AND href = 'https://preview.example.test/intro'
  AND updated_at = '2026-06-13T00:00:00.000Z';

COMMIT;
