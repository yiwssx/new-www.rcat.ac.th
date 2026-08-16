-- P5A optional post-M17-B fixture sentinel.
-- Read-only. Run only after confirming public_home_sections exists.

SELECT 'public_home_sections' AS source, id AS fixture_key
FROM public_home_sections
WHERE id = 'sample-public-read-home-section-001';
