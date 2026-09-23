# CMS governance client surface

The governance client keeps higher-risk content lifecycle operations separate from generic CRUD calls.

Current content lifecycle operations include revision history/restore, authenticated preview, expiry scheduling, explicit Draft/Review editorial transitions, soft-delete trash listing/restore, audit-log reads, and media usage/accessibility management.

Trash restore is intentionally conservative: the original slug is recovered from the delete revision snapshot, active-slug collisions are rejected, and restored content returns as Draft rather than being republished automatically.
