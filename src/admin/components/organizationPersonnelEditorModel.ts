import { z } from "zod";
import type { OrganizationPersonnelRow, OrganizationPersonnelWrite } from "../../features/organization-admin/api";

export const personnelEditorSchema = z
  .object({
    displayName: z.string().trim().min(1, "กรุณาระบุชื่อบุคลากร").max(200),
    personnelType: z.string().trim().max(120),
    employmentPosition: z.string().trim().max(200),
    photoMediaId: z.string().nullable(),
    publicEmail: z.string().trim().max(254),
    publicPhone: z.string().trim().max(40),
    showPublicEmail: z.boolean(),
    showPublicPhone: z.boolean(),
    active: z.boolean()
  })
  .superRefine((value, ctx) => {
    if (value.publicEmail && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value.publicEmail)) {
      ctx.addIssue({ code: "custom", path: ["publicEmail"], message: "รูปแบบอีเมลไม่ถูกต้อง" });
    }
    if (value.showPublicEmail && !value.publicEmail) {
      ctx.addIssue({ code: "custom", path: ["publicEmail"], message: "กรุณาระบุอีเมลก่อนอนุญาตให้เผยแพร่" });
    }
    if (value.showPublicPhone && !value.publicPhone) {
      ctx.addIssue({ code: "custom", path: ["publicPhone"], message: "กรุณาระบุโทรศัพท์ก่อนอนุญาตให้เผยแพร่" });
    }
  });

export type PersonnelEditorForm = z.infer<typeof personnelEditorSchema>;

export function personnelEditorDefaults(row: OrganizationPersonnelRow | null): PersonnelEditorForm {
  return {
    displayName: row?.display_name ?? "",
    personnelType: row?.personnel_type ?? "",
    employmentPosition: row?.employment_position ?? "",
    photoMediaId: row?.photo_media_id ?? null,
    publicEmail: row?.public_email ?? "",
    publicPhone: row?.public_phone ?? "",
    showPublicEmail: row?.show_public_email === 1,
    showPublicPhone: row?.show_public_phone === 1,
    active: row ? row.active === 1 : true
  };
}

export function toPersonnelWrite(form: PersonnelEditorForm): OrganizationPersonnelWrite {
  return personnelEditorSchema.parse(form);
}

