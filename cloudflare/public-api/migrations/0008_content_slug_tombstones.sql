-- Release public slugs retained by content rows that were soft-deleted before slug tombstoning.

UPDATE contents
SET slug = '__deleted__:' || id
WHERE COALESCE(deleted_at, '') <> ''
  AND substr(slug, 1, length('__deleted__:')) <> '__deleted__:';
