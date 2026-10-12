-- READ ONLY: review only the rows that would change in legacy order normalization.
-- Scope: sibling organization units, positions within the same unit/group,
-- and assignments within the same position. A single leading zero is valid.
-- Ties use the same stable ordering as the current organization read models.
WITH
unit_order AS (
  SELECT u.content_id AS id, json_array(u.parent_content_id) AS scope,
         u.sort_order AS old_order,
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
units AS (
  SELECT 'unit' AS kind, id, scope, old_order, next_order,
         MAX(tied_rows) OVER (PARTITION BY scope) AS maximum_tie
  FROM unit_order
),
position_order AS (
  SELECT id, json_array(unit_content_id, group_label, group_sort_order) AS scope,
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
positions AS (
  SELECT 'position' AS kind, id, scope, old_order, next_order,
         MAX(tied_rows) OVER (PARTITION BY scope) AS maximum_tie
  FROM position_order
),
assignment_order AS (
  SELECT id, json_array(position_id) AS scope, sort_order AS old_order,
         ROW_NUMBER() OVER (
           PARTITION BY position_id ORDER BY sort_order ASC, id ASC
         ) - 1 AS next_order,
         COUNT(*) OVER (PARTITION BY position_id, sort_order) AS tied_rows
  FROM organization_assignments
),
assignments AS (
  SELECT 'assignment' AS kind, id, scope, old_order, next_order,
         MAX(tied_rows) OVER (PARTITION BY scope) AS maximum_tie
  FROM assignment_order
)
SELECT kind, scope, id, old_order, next_order
FROM (
  SELECT * FROM units
  UNION ALL SELECT * FROM positions
  UNION ALL SELECT * FROM assignments
)
WHERE maximum_tie > 1 AND old_order <> next_order
ORDER BY kind, scope, next_order, id;
