import type {
  CalendarEvent,
  ContentStatus,
  ContentType,
  IntegrationState,
  MediaType,
  User,
  UserAccount
} from "../types";

export const contentTypeLabels: Record<ContentType, string> = {
  page: "หน้าเว็บ",
  news: "ข่าว",
  program: "หลักสูตร",
  announcement: "ประกาศ",
  blog: "บทความ"
};

export const contentStatusLabels: Record<ContentStatus, string> = {
  draft: "ฉบับร่าง",
  review: "รอตรวจสอบ",
  scheduled: "ตั้งเวลาเผยแพร่",
  published: "เผยแพร่แล้ว"
};

export const mediaTypeLabels: Record<MediaType, string> = {
  image: "รูปภาพ",
  document: "เอกสาร",
  sheet: "ตารางข้อมูล",
  video: "วิดีโอ"
};

export const integrationStateLabels: Record<IntegrationState, string> = {
  connected: "เชื่อมต่อแล้ว",
  pending: "รอดำเนินการ",
  error: "มีข้อผิดพลาด"
};

export const eventStatusLabels: Record<CalendarEvent["status"], string> = {
  confirmed: "ยืนยันแล้ว",
  draft: "ฉบับร่าง",
  cancelled: "ยกเลิก"
};

export const visibilityLabels: Record<NonNullable<CalendarEvent["visibility"]>, string> = {
  public: "สาธารณะ",
  private: "ภายใน"
};

export const userRoleLabels: Record<User["role"], string> = {
  admin: "ผู้ดูแลระบบ",
  editor: "บรรณาธิการ",
  viewer: "ผู้เข้าชม"
};

export const userStatusLabels: Record<UserAccount["status"], string> = {
  active: "ใช้งาน",
  disabled: "ปิดใช้งาน"
};

export const integrationServiceLabels: Record<string, string> = {
  Sheets: "Google Sheets",
  Drive: "Google Drive",
  Docs: "Google Docs"
};
