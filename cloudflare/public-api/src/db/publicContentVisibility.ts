export const PUBLIC_PUBLISHED_CONTENT_FILTER_SQL =
  "status = ?1 AND (COALESCE(publish_at, '') = '' OR datetime(publish_at) <= datetime(?2)) AND (COALESCE(unpublish_at, '') = '' OR datetime(unpublish_at) > datetime(?2))";

export function publicPublishedContentBindings(...bindings: unknown[]) {
  const now = new Date().toISOString();
  return ["published", now, ...bindings];
}
