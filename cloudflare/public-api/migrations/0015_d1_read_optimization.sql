-- Reduce public D1 row reads on the highest-frequency paths without changing
-- public response contracts. These are persistent schema indexes, never runtime
-- CREATE INDEX calls.

CREATE INDEX IF NOT EXISTS idx_contents_public_type_order_v2
  ON contents (status, type, publish_at DESC, updated_at DESC)
  WHERE deleted_at = '';

CREATE INDEX IF NOT EXISTS idx_documents_public_home_order_v2
  ON documents (status, pinned DESC, sort_order ASC, published_at DESC, updated_at DESC)
  WHERE deleted_at = '';

CREATE INDEX IF NOT EXISTS idx_visitor_presence_online_v2
  ON visitor_presence (last_seen_at, visitor_id);
