import { requireD1Database } from "./documentsRepository";
import type { Env } from "../env";

export async function getContentRedirectTarget(env: Env, oldSlug: string) {
  try {
    const result = await requireD1Database(env)
      .prepare(
        `SELECT r.new_slug
         FROM content_redirects r
         INNER JOIN contents c ON c.slug = r.new_slug
         WHERE r.old_slug = ?
           AND COALESCE(c.deleted_at, '') = ''
           AND c.status = 'published'
           AND (c.publish_at = '' OR datetime(c.publish_at) <= datetime('now'))
           AND (COALESCE(c.unpublish_at, '') = '' OR datetime(c.unpublish_at) > datetime('now'))
         LIMIT 1`
      )
      .bind(oldSlug)
      .all<{ new_slug: string }>();

    return result.results?.[0]?.new_slug?.trim() || "";
  } catch (error) {
    // Keep pre-migration preview/test environments backward compatible.
    if (error instanceof Error && /no such table:\s*content_redirects/i.test(error.message)) {
      return "";
    }
    throw error;
  }
}
