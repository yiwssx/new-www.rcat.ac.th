import { describe, expect, it } from "vitest";
import {
  personnelEditorDefaults,
  personnelEditorSchema,
  toPersonnelWrite
} from "./OrganizationPersonnelEditorDialog";

describe("Phase 5 personnel privacy and validation contract", () => {
  const valid = {
    displayName: "เจ้าหน้าที่ ทดสอบ",
    personnelType: "เจ้าหน้าที่",
    employmentPosition: "",
    photoMediaId: null,
    publicEmail: "",
    publicPhone: "",
    showPublicEmail: false,
    showPublicPhone: false,
    active: true
  };

  it("starts with private contacts and one canonical profile", () => {
    expect(personnelEditorDefaults(null)).toMatchObject({
      displayName: "",
      photoMediaId: null,
      showPublicEmail: false,
      showPublicPhone: false,
      active: true
    });
    expect(toPersonnelWrite(valid)).toMatchObject({
      displayName: "เจ้าหน้าที่ ทดสอบ",
      showPublicEmail: false,
      showPublicPhone: false
    });
  });

  it("rejects malformed email, missing name and publishing empty contact fields", () => {
    expect(personnelEditorSchema.safeParse({ ...valid, displayName: "" }).success).toBe(false);
    expect(personnelEditorSchema.safeParse({ ...valid, publicEmail: "bad@" }).success).toBe(false);
    expect(personnelEditorSchema.safeParse({ ...valid, showPublicEmail: true }).success).toBe(false);
    expect(personnelEditorSchema.safeParse({ ...valid, showPublicPhone: true }).success).toBe(false);
    expect(personnelEditorSchema.safeParse({
      ...valid, publicEmail: "staff@example.org", showPublicEmail: true,
      publicPhone: "043123456", showPublicPhone: true
    }).success).toBe(true);
  });
});
