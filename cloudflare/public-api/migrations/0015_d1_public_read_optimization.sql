-- D1 public-read optimization: keep hot homepage/list queries on bounded indexed paths.
-- Additive only. No data rewrite and no public API contract change.

CREATE INDEX IF NOT EXISTS idx_contents_public_type_publish
  ON contents (status, type, publish_at DESC, updated_at DESC)
  WHERE COALESCE(deleted_at, '') = '';

CREATE INDEX IF NOT EXISTS idx_contents_public_publish
  ON contents (status, publish_at DESC, updated_at DESC)
  WHERE COALESCE(deleted_at, '') = '';

CREATE INDEX IF NOT EXISTS idx_documents_public_home
  ON documents (status, pinned DESC, sort_order ASC, published_at DESC, updated_at DESC)
  WHERE COALESCE(deleted_at, '') = '';

CREATE INDEX IF NOT EXISTS idx_visitor_presence_online_cover
  ON visitor_presence (last_seen_at, visitor_id);
