/**
 * Route-safe identifiers only. Keep this module independent of Admin/Auth
 * implementation so the public entry graph remains lazy.
 */
export const settingsCategories = [
  "general",
  "homepage",
  "leadership",
  "footer",
  "appearance",
  "visitors",
  "social",
  "access"
] as const;
