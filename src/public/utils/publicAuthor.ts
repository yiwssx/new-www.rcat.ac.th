const INTERNAL_AUTHOR_NAMES = new Set([
  "admin",
  "administrator",
  "cms",
  "ผู้ดูแลระบบ",
  "ผู้แก้ไข cms",
  "facebook-import"
]);

export function getPublicAuthorLabel(owner: string | null | undefined): string {
  const label = String(owner ?? "").trim();
  return label && !INTERNAL_AUTHOR_NAMES.has(label.toLowerCase()) ? label : "";
}
