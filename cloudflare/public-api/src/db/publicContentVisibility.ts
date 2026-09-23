export const PUBLIC_PUBLISHED_CONTENT_FILTER_SQL =
  "status = ? AND (COALESCE(publish_at, '') = '' OR datetime(publish_at) <= datetime(?)) AND (COALESCE(unpublish_at, '') = '' OR datetime(unpublish_at) > datetime(?))";

export function publicPublishedContentBindings(...bindings: unknown[]) {
  const now = new Date().toISOString();
  return ["published", now, now, ...bindings];
}
