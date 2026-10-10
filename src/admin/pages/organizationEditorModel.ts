import { z } from "zod";
import { fromLocalDateTimeInputValue, toLocalDateTimeInputValue } from "../../utils/calendar";
import type { OrganizationUnitListRow, OrganizationUnitWrite } from "../../features/organization-admin/api";
import { validateOrganizationParent } from "../../../shared/organizationContracts";

export const ORGANIZATION_KIND_LABELS = {
  division: "ฝ่าย",
  work: "งาน",
  department: "แผนกวิชา",
  program: "สาขาวิชา",
  subunit: "หน่วยงานย่อย"
} as const;

export const ORGANIZATION_STATUS_LABELS = {
  draft: "ฉบับร่าง",
  review: "รอตรวจ",
  scheduled: "กำหนดเผยแพร่",
  published: "เผยแพร่แล้ว"
} as const;

export const organizationEditorSchema = z
  .object({
    title: z.string().trim().min(1, "กรุณาระบุชื่อหน่วยงาน").max(250),
    slug: z
      .string()
      .trim()
      .min(1, "กรุณาระบุ Slug")
      .max(160)
      .regex(
        /^[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:-[\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*$/u,
        "Slug ใช้ตัวอักษร ตัวเลข และขีดกลางระหว่างคำ"
      ),
    summary: z.string().trim().max(2000),
    unitKind: z.enum(["division", "work", "department", "program", "subunit"]),
    parentContentId: z.string(),
    sortOrder: z.number().int().min(0),
    status: z.enum(["draft", "review", "scheduled", "published"]),
    publishAt: z.string(),
    unpublishAt: z.string()
  })
  .superRefine((value, context) => {
    if (
      new Set([
        "admin",
        "api",
        "app",
        "auth",
        "documents",
        "login",
        "news",
        "organization",
        "personnel",
        "sitemap",
        "robots",
        "search"
      ]).has(value.slug.toLowerCase())
    ) {
      context.addIssue({ code: "custom", path: ["slug"], message: "Slug นี้เป็นคำสงวน" });
    }
    const publishAt = fromLocalDateTimeInputValue(value.publishAt);
    const unpublishAt = fromLocalDateTimeInputValue(value.unpublishAt);
    if (value.publishAt && !publishAt) {
      context.addIssue({ code: "custom", path: ["publishAt"], message: "วันเวลาเผยแพร่ไม่ถูกต้อง" });
    }
    if (value.unpublishAt && !unpublishAt) {
      context.addIssue({ code: "custom", path: ["unpublishAt"], message: "วันเวลาหยุดเผยแพร่ไม่ถูกต้อง" });
    }
    if (value.status === "scheduled" && (!publishAt || Date.parse(publishAt) <= Date.now())) {
      context.addIssue({ code: "custom", path: ["publishAt"], message: "ต้องเลือกวันเวลาเผยแพร่ในอนาคต" });
    }
    if (
      unpublishAt &&
      ((!publishAt && value.status !== "published") || (publishAt && Date.parse(unpublishAt) <= Date.parse(publishAt)))
    ) {
      context.addIssue({
        code: "custom",
        path: ["unpublishAt"],
        message: "วันเวลาหยุดเผยแพร่ต้องอยู่หลังวันเวลาเผยแพร่"
      });
    }
  });

export type OrganizationEditorForm = z.infer<typeof organizationEditorSchema>;

export function editorDefaults(row?: OrganizationUnitListRow | null): OrganizationEditorForm {
  return {
    title: row?.title ?? "",
    slug: row?.slug ?? "",
    summary: row?.summary ?? "",
    unitKind: (row?.unit_kind as OrganizationEditorForm["unitKind"]) ?? "division",
    parentContentId: row?.parent_content_id ?? "",
    sortOrder: row?.sort_order ?? 0,
    status: row?.status ?? "draft",
    publishAt: toLocalDateTimeInputValue(row?.publish_at),
    unpublishAt: toLocalDateTimeInputValue(row?.unpublish_at)
  };
}

export function availableOrganizationParents(units: readonly OrganizationUnitListRow[], editingId: string | null) {
  if (!editingId) return [...units];
  return units.filter(
    (candidate) =>
      validateOrganizationParent(
        units.map((unit) => ({ contentId: unit.content_id, parentContentId: unit.parent_content_id })),
        editingId,
        candidate.content_id
      ).ok
  );
}

export function toOrganizationUnitWrite(form: OrganizationEditorForm): OrganizationUnitWrite {
  const value = organizationEditorSchema.parse(form);
  const convertedPublish = fromLocalDateTimeInputValue(value.publishAt);
  // The Worker supplies the authoritative publish timestamp for immediate publication.
  const effectivePublishAt =
    value.status === "published" && !convertedPublish ? new Date().toISOString() : convertedPublish;
  const unpublish = fromLocalDateTimeInputValue(value.unpublishAt);
  if (unpublish && (!effectivePublishAt || Date.parse(unpublish) <= Date.parse(effectivePublishAt))) {
    throw new Error("วันเวลาหยุดเผยแพร่ต้องอยู่หลังวันเวลาเผยแพร่");
  }
  return {
    title: value.title,
    slug: value.slug.toLowerCase(),
    summary: value.summary,
    unitKind: value.unitKind,
    parentContentId: value.parentContentId || null,
    sortOrder: value.sortOrder,
    status: value.status,
    publishAt: effectivePublishAt,
    unpublishAt: unpublish
  };
}
