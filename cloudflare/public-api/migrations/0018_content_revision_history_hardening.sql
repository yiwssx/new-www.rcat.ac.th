-- v3.3.1 revision-history hardening.
-- The content_revisions table was introduced by migration 0016. This additive
-- migration preserves that canonical history store, adds the revision-order
-- access path used by history/detail reads, and makes historical rows immutable.

PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_content_revisions_content_revision
  ON content_revisions (content_id, revision DESC);

CREATE TRIGGER IF NOT EXISTS trg_content_revisions_immutable_update
BEFORE UPDATE ON content_revisions
BEGIN
  SELECT RAISE(ABORT, 'content revisions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_content_revisions_immutable_delete
BEFORE DELETE ON content_revisions
BEGIN
  SELECT RAISE(ABORT, 'content revisions are immutable');
END;
