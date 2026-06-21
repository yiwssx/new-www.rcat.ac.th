import type { ContentItem } from "../public-content/types";

export const ADMIN_STALE_REVISION_MESSAGE =
  "ข้อมูลนี้มีการเปลี่ยนแปลง ระบบโหลดข้อมูลล่าสุดแล้ว กรุณาตรวจสอบและบันทึกอีกครั้ง";
export const ADMIN_DUPLICATE_SLUG_MESSAGE = "Slug นี้ถูกใช้แล้ว กรุณาเปลี่ยน Slug";

export class AdminStaleRevisionError extends Error {
  latestItem?: ContentItem;

  constructor() {
    super(ADMIN_STALE_REVISION_MESSAGE);
    this.name = "AdminStaleRevisionError";
  }
}

export function isAdminStaleRevisionError(error: unknown): error is AdminStaleRevisionError {
  return error instanceof AdminStaleRevisionError;
}

export class AdminDuplicateSlugError extends Error {
  constructor() {
    super(ADMIN_DUPLICATE_SLUG_MESSAGE);
    this.name = "AdminDuplicateSlugError";
  }
}
