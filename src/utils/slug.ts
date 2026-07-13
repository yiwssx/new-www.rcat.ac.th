function normalizeSlugValue(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .toLowerCase();
}

export function sanitizeSlugInput(value: unknown) {
  return normalizeSlugValue(value)
    .replace(/[^\p{Letter}\p{Mark}\p{Number}-]+/gu, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "");
}

export function finalizeSlug(value: unknown) {
  return sanitizeSlugInput(value).replace(/-+$/g, "");
}

export function slugify(value: unknown) {
  return finalizeSlug(value);
}
