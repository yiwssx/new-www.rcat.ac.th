import type { CmsAssurance } from "./types";

const STATUS_MESSAGES: Record<number, string> = {
  400: "ข้อมูลที่ส่งไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง",
  401: "ข้อมูลยืนยันตัวตนไม่ถูกต้องหรือเซสชันหมดอายุ",
  403: "ไม่มีสิทธิ์ดำเนินการหรือการตรวจสอบความปลอดภัยไม่ผ่าน",
  409: "สถานะบัญชีมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่",
  412: "ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดข้อมูลใหม่ก่อนบันทึก",
  428: "กรุณายืนยันตัวตนอีกครั้งเพื่อดำเนินการต่อ",
  429: "มีการลองหลายครั้งเกินไป กรุณารอสักครู่",
  503: "ระบบยืนยันตัวตนไม่พร้อมใช้งานในขณะนี้"
};

export class CmsAuthError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?: number;
  readonly assurance?: CmsAssurance;

  constructor(
    status: number,
    options: {
      retryAfterSeconds?: number;
      assurance?: CmsAssurance;
      message?: string;
    } = {}
  ) {
    super(options.message ?? STATUS_MESSAGES[status] ?? "ไม่สามารถดำเนินการยืนยันตัวตนได้");
    this.name = "CmsAuthError";
    this.status = status;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.assurance = options.assurance;
  }
}

export function getCmsAuthErrorMessage(error: unknown, fallback = "ไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง") {
  return error instanceof CmsAuthError ? error.message : fallback;
}
