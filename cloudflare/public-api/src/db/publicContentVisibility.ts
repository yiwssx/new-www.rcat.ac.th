export const PUBLIC_PUBLISHED_CONTENT_FILTER_SQL =
  "status = ? AND (COALESCE(publish_at, '') = '' OR datetime(publish_at) <= datetime(?))";

export function publicPublishedContentBindings(...bindings: unknown[]) {
  return ["published", new Date().toISOString(), ...bindings];
}
