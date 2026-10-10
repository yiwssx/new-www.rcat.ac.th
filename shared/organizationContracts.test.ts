import { describe, expect, it } from "vitest";
import {
  isOrganizationUnitKind,
  isValidOrganizationPublicSlug,
  ORGANIZATION_CONTENT_TYPE,
  projectOrganizationPersonPublic,
  validateOrganizationParent
} from "./organizationContracts";

describe("Organization Chart shared contracts", () => {
  it("declares the dedicated CMS type and initial extensible unit kinds", () => {
    expect(ORGANIZATION_CONTENT_TYPE).toBe("organization");
    expect(isOrganizationUnitKind("department")).toBe(true);
    expect(isOrganizationUnitKind("program")).toBe(true);
    expect(isOrganizationUnitKind("random")).toBe(false);
  });

  it("accepts Thai and English public slugs while rejecting unsafe paths", () => {
    expect(isValidOrganizationPublicSlug("ฝ่ายวิชาการ")).toBe(true);
    expect(isValidOrganizationPublicSlug("academic-office")).toBe(true);
    expect(isValidOrganizationPublicSlug("งาน-อาคารสถานที่")).toBe(true);
    expect(isValidOrganizationPublicSlug("../admin")).toBe(false);
    expect(isValidOrganizationPublicSlug("foo/bar")).toBe(false);
    expect(isValidOrganizationPublicSlug("foo--bar")).toBe(false);
  });

  it("rejects hierarchy self-links, missing parents, and descendant cycles", () => {
    const units = [
      { contentId: "division", parentContentId: null },
      { contentId: "work", parentContentId: "division" },
      { contentId: "subunit", parentContentId: "work" }
    ];

    expect(validateOrganizationParent(units, "new", "work")).toEqual({ ok: true });
    expect(validateOrganizationParent(units, "division", null)).toEqual({ ok: true });
    expect(validateOrganizationParent(units, "work", "work")).toEqual({
      ok: false,
      error: "self-parent"
    });
    expect(validateOrganizationParent(units, "work", "missing")).toEqual({
      ok: false,
      error: "missing-parent"
    });
    expect(validateOrganizationParent(units, "division", "subunit")).toEqual({
      ok: false,
      error: "cycle"
    });
  });

  it("redacts personal contact details unless explicitly opted into public display", () => {
    const person = {
      id: "staff-1",
      displayName: "Sample Staff",
      personnelType: "teacher",
      employmentPosition: "Instructor",
      photoMediaId: null,
      publicEmail: "test@example.invalid",
      publicPhone: "0000000000",
      showPublicEmail: false,
      showPublicPhone: false,
      active: true,
      revision: 0
    };
    expect(projectOrganizationPersonPublic(person)).toMatchObject({ publicEmail: "", publicPhone: "" });
    expect(projectOrganizationPersonPublic({ ...person, showPublicEmail: true })).toMatchObject({
      publicEmail: "test@example.invalid",
      publicPhone: ""
    });
  });
});
