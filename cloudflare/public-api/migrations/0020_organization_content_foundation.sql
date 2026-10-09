-- Organization Chart Phase 1: additive data foundation only.
-- No content, personnel, menu entries, or production data are seeded.
-- The existing contents table owns slugs, publishing, SEO and revisions.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organization_units (
  content_id TEXT PRIMARY KEY REFERENCES contents(id) ON DELETE RESTRICT,
  parent_content_id TEXT REFERENCES organization_units(content_id) ON DELETE RESTRICT,
  unit_kind TEXT NOT NULL CHECK (length(trim(unit_kind)) > 0),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  settings_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings_json)),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  CHECK (parent_content_id IS NULL OR parent_content_id <> content_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_units_parent_order
  ON organization_units (parent_content_id, sort_order, content_id);

CREATE INDEX IF NOT EXISTS idx_organization_units_kind_order
  ON organization_units (unit_kind, sort_order);

CREATE TABLE IF NOT EXISTS personnel (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  personnel_type TEXT NOT NULL DEFAULT '' ,
  employment_position TEXT NOT NULL DEFAULT '',
  photo_media_id TEXT REFERENCES media_assets(id) ON DELETE RESTRICT,
  public_email TEXT NOT NULL DEFAULT '',
  public_phone TEXT NOT NULL DEFAULT '',
  show_public_email INTEGER NOT NULL DEFAULT 0 CHECK (show_public_email IN (0, 1)),
  show_public_phone INTEGER NOT NULL DEFAULT 0 CHECK (show_public_phone IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_personnel_active_name
  ON personnel (active, display_name, id);

CREATE INDEX IF NOT EXISTS idx_personnel_photo
  ON personnel (photo_media_id);

CREATE TABLE IF NOT EXISTS organization_positions (
  id TEXT PRIMARY KEY,
  unit_content_id TEXT NOT NULL REFERENCES organization_units(content_id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  group_label TEXT NOT NULL DEFAULT '',
  group_sort_order INTEGER NOT NULL DEFAULT 0 CHECK (group_sort_order >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  display_style TEXT NOT NULL DEFAULT 'default',
  occupant_limit INTEGER CHECK (occupant_limit IS NULL OR occupant_limit >= 1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_organization_positions_unit_order
  ON organization_positions (unit_content_id, group_sort_order, sort_order, id);

CREATE TABLE IF NOT EXISTS organization_assignments (
  id TEXT PRIMARY KEY,
  personnel_id TEXT NOT NULL REFERENCES personnel(id) ON DELETE RESTRICT,
  position_id TEXT NOT NULL REFERENCES organization_positions(id) ON DELETE RESTRICT,
  duty_detail TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  starts_at TEXT NOT NULL DEFAULT '',
  ends_at TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  CHECK (ends_at = '' OR (starts_at <> '' AND ends_at >= starts_at))
);

-- No UNIQUE(personnel_id, position_id): the same person may hold several
-- distinct duties in one unit and across different units.
CREATE INDEX IF NOT EXISTS idx_organization_assignments_position_order
  ON organization_assignments (position_id, enabled, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_organization_assignments_personnel
  ON organization_assignments (personnel_id, enabled, position_id);

CREATE TRIGGER IF NOT EXISTS trg_organization_units_content_insert
BEFORE INSERT ON organization_units
BEGIN
  SELECT RAISE(ABORT, 'organization unit requires active organization content')
  WHERE NOT EXISTS (
    SELECT 1 FROM contents
    WHERE id = NEW.content_id AND type = 'organization' AND COALESCE(deleted_at, '') = ''
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_organization_units_content_update
BEFORE UPDATE OF content_id ON organization_units
BEGIN
  SELECT RAISE(ABORT, 'organization unit requires active organization content')
  WHERE NOT EXISTS (
    SELECT 1 FROM contents
    WHERE id = NEW.content_id AND type = 'organization' AND COALESCE(deleted_at, '') = ''
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_organization_content_type_protect
BEFORE UPDATE OF type, deleted_at ON contents
WHEN EXISTS (SELECT 1 FROM organization_units WHERE content_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'resolve organization unit before changing content type or deleting')
  WHERE NEW.type <> 'organization' OR COALESCE(NEW.deleted_at, '') <> '';
END;

-- Recursive ancestry is evaluated on every parent change; no fixed depth.
CREATE TRIGGER IF NOT EXISTS trg_organization_units_cycle_insert
BEFORE INSERT ON organization_units
WHEN NEW.parent_content_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'organization hierarchy cycle')
  WHERE EXISTS (
    WITH RECURSIVE ancestors(id, parent_id) AS (
      SELECT content_id, parent_content_id
      FROM organization_units WHERE content_id = NEW.parent_content_id
      UNION ALL
      SELECT unit.content_id, unit.parent_content_id
      FROM organization_units AS unit
      JOIN ancestors ON unit.content_id = ancestors.parent_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.content_id
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_organization_units_cycle_update
BEFORE UPDATE OF parent_content_id ON organization_units
WHEN NEW.parent_content_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'organization hierarchy cycle')
  WHERE EXISTS (
    WITH RECURSIVE ancestors(id, parent_id) AS (
      SELECT content_id, parent_content_id
      FROM organization_units WHERE content_id = NEW.parent_content_id
      UNION ALL
      SELECT unit.content_id, unit.parent_content_id
      FROM organization_units AS unit
      JOIN ancestors ON unit.content_id = ancestors.parent_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.content_id
  );
END;

-- Capacity counts distinct enabled occupants, not duplicate duties.
CREATE TRIGGER IF NOT EXISTS trg_organization_assignments_capacity_insert
BEFORE INSERT ON organization_assignments
WHEN NEW.enabled = 1
BEGIN
  SELECT RAISE(ABORT, 'organization position at occupant limit')
  WHERE (
    SELECT occupant_limit FROM organization_positions WHERE id = NEW.position_id
  ) IS NOT NULL
  AND (
    SELECT COUNT(DISTINCT personnel_id)
    FROM organization_assignments
    WHERE position_id = NEW.position_id AND enabled = 1 AND personnel_id <> NEW.personnel_id
  ) >= (
    SELECT occupant_limit FROM organization_positions WHERE id = NEW.position_id
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_organization_assignments_capacity_update
BEFORE UPDATE OF position_id, personnel_id, enabled ON organization_assignments
WHEN NEW.enabled = 1
BEGIN
  SELECT RAISE(ABORT, 'organization position at occupant limit')
  WHERE (
    SELECT occupant_limit FROM organization_positions WHERE id = NEW.position_id
  ) IS NOT NULL
  AND (
    SELECT COUNT(DISTINCT personnel_id)
    FROM organization_assignments
    WHERE position_id = NEW.position_id AND enabled = 1
      AND id <> NEW.id AND personnel_id <> NEW.personnel_id
  ) >= (
    SELECT occupant_limit FROM organization_positions WHERE id = NEW.position_id
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_organization_positions_capacity_update
BEFORE UPDATE OF occupant_limit ON organization_positions
WHEN NEW.occupant_limit IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'organization position at occupant limit')
  WHERE NEW.occupant_limit < (
    SELECT COUNT(DISTINCT personnel_id)
    FROM organization_assignments
    WHERE position_id = NEW.id AND enabled = 1
  );
END;

-- Each separate organization-domain write must advance its own revision.
CREATE TRIGGER IF NOT EXISTS trg_organization_units_revision
BEFORE UPDATE ON organization_units
WHEN NEW.revision <> OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'organization revision must advance');
END;

CREATE TRIGGER IF NOT EXISTS trg_personnel_revision
BEFORE UPDATE ON personnel
WHEN NEW.revision <> OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'organization revision must advance');
END;

CREATE TRIGGER IF NOT EXISTS trg_organization_positions_revision
BEFORE UPDATE ON organization_positions
WHEN NEW.revision <> OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'organization revision must advance');
END;

CREATE TRIGGER IF NOT EXISTS trg_organization_assignments_revision
BEFORE UPDATE ON organization_assignments
WHEN NEW.revision <> OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'organization revision must advance');
END;
