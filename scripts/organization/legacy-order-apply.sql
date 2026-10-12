-- MANUAL, PROTECTED PRODUCTION DATA OPERATION. Never run automatically.
-- Preconditions: correct D1 binding independently verified; Time Travel
-- checkpoint and private export captured; no concurrent organization edits;
-- review scripts/organization/legacy-order-preview.sql first.
-- This file changes ONLY sort_order, revision, updated_at for duplicate-order
-- sibling groups. It does not alter personnel, membership, parentage, workflow,
-- schema, Worker deployments, or correctly ordered groups.
-- A valid group's first stored order remains 0 (shown as rank 1 in Admin).
-- Do not wrap in explicit BEGIN/COMMIT: Wrangler D1 --file manages execution.

WITH ranked AS MATERIALIZED (
  SELECT u.content_id AS id, u.parent_content_id, u.sort_order AS old_order,
         ROW_NUMBER() OVER (
           PARTITION BY u.parent_content_id
           ORDER BY u.sort_order ASC, c.title COLLATE NOCASE ASC, u.content_id ASC
         ) - 1 AS next_order,
         COUNT(*) OVER (
           PARTITION BY u.parent_content_id, u.sort_order
         ) AS tied_rows
  FROM organization_units AS u
  JOIN contents AS c ON c.id = u.content_id
),
affected AS MATERIALIZED (
  SELECT id, old_order, next_order,
         MAX(tied_rows) OVER (PARTITION BY parent_content_id) AS maximum_tie
  FROM ranked
)
UPDATE organization_units
SET sort_order = (SELECT next_order FROM affected WHERE id = organization_units.content_id),
    revision = revision + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE content_id IN (
  SELECT id FROM affected WHERE maximum_tie > 1 AND old_order <> next_order
);

WITH ranked AS MATERIALIZED (
  SELECT id, unit_content_id, group_label, group_sort_order,
         sort_order AS old_order,
         ROW_NUMBER() OVER (
           PARTITION BY unit_content_id, group_label, group_sort_order
           ORDER BY sort_order ASC, id ASC
         ) - 1 AS next_order,
         COUNT(*) OVER (
           PARTITION BY unit_content_id, group_label, group_sort_order, sort_order
         ) AS tied_rows
  FROM organization_positions
),
affected AS MATERIALIZED (
  SELECT id, old_order, next_order,
         MAX(tied_rows) OVER (
           PARTITION BY unit_content_id, group_label, group_sort_order
         ) AS maximum_tie
  FROM ranked
)
UPDATE organization_positions
SET sort_order = (SELECT next_order FROM affected WHERE id = organization_positions.id),
    revision = revision + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id IN (
  SELECT id FROM affected WHERE maximum_tie > 1 AND old_order <> next_order
);

WITH ranked AS MATERIALIZED (
  SELECT id, position_id, sort_order AS old_order,
         ROW_NUMBER() OVER (
           PARTITION BY position_id ORDER BY sort_order ASC, id ASC
         ) - 1 AS next_order,
         COUNT(*) OVER (
           PARTITION BY position_id, sort_order
         ) AS tied_rows
  FROM organization_assignments
),
affected AS MATERIALIZED (
  SELECT id, old_order, next_order,
         MAX(tied_rows) OVER (PARTITION BY position_id) AS maximum_tie
  FROM ranked
)
UPDATE organization_assignments
SET sort_order = (SELECT next_order FROM affected WHERE id = organization_assignments.id),
    revision = revision + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id IN (
  SELECT id FROM affected WHERE maximum_tie > 1 AND old_order <> next_order
);
