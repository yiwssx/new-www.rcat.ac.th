import { describe, expect, it } from "vitest";
import type { OrganizationUnitListRow } from "../../features/organization-admin/api";
import {
  availableOrganizationParents,
  editorDefaults,
  organizationEditorSchema,
  toOrganizationUnitWrite
} from "./organizationEditorModel";

const basic = {
  title: "ฝ่ายบริหารทรัพยากร",
  slug: "division-01",
  summary: "",
  status: "draft" as const,
  unitKind: "division" as const,
  parentContentId: "",
  sortOrder: 0,
  publishAt: "",
  unpublishAt: ""
};

function unit(id: string, parent: string | null): OrganizationUnitListRow {
  return {
    content_id: id,
    parent_content_id: parent,
    unit_kind: "division",
    sort_order: 0,
    slug: id,
    title: id,
    summary: "",
    status: "draft",
    publish_at: "",
    unpublish_at: "",
    content_revision: 0,
    unit_revision: 0
  };
}

describe("Organization Phase 4 editor model", () => {
  it("rejects malformed and reserved slugs or impossible publication windows", () => {
    expect(organizationEditorSchema.safeParse({ ...basic, slug: "api" }).success).toBe(false);
    expect(organizationEditorSchema.safeParse({ ...basic, slug: "bad slug" }).success).toBe(false);
    expect(organizationEditorSchema.safeParse({ ...basic, title: "" }).success).toBe(false);
    expect(organizationEditorSchema.safeParse({ ...basic, sortOrder: -1 }).success).toBe(false);
    expect(organizationEditorSchema.safeParse({ ...basic, status: "scheduled" }).success).toBe(false);
    expect(
      organizationEditorSchema.safeParse({ ...basic, status: "scheduled", publishAt: "2030-01-01T09:00" }).success
    ).toBe(true);
    expect(
      organizationEditorSchema.safeParse({
        ...basic,
        status: "scheduled",
        publishAt: "2030-01-01T09:00",
        unpublishAt: "2029-12-31T09:00"
      }).success
    ).toBe(false);
  });

  it("converts Thai local time to canonical UTC and null parent identity", () => {
    const data = toOrganizationUnitWrite({ ...basic, status: "scheduled", publishAt: "2030-01-01T09:00" });
    expect(data).toMatchObject({
      slug: "division-01",
      parentContentId: null,
      publishAt: "2030-01-01T02:00:00.000Z"
    });
  });

  it("filters out self and all descendants from parent selection", () => {
    const items = [unit("root", null), unit("child", "root"), unit("grandchild", "child"), unit("other", null)];
    expect(availableOrganizationParents(items, "root").map((value) => value.content_id)).toEqual(["other"]);
    expect(availableOrganizationParents(items, "child").map((value) => value.content_id)).toEqual(["root", "other"]);
    expect(availableOrganizationParents(items, null)).toHaveLength(4);
  });

  it("restores the current revision-bound draft when opening an existing editor", () => {
    expect(editorDefaults({ ...unit("head", null), title: "หน่วยงาน", status: "published" })).toMatchObject({
      title: "หน่วยงาน",
      slug: "head",
      parentContentId: "",
      status: "published"
    });
  });
});
