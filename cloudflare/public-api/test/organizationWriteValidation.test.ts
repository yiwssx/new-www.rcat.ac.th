import { describe, expect, it } from "vitest";
import {
  OrganizationInputError,
  parseOrganizationAssignmentWrite,
  parseOrganizationPositionWrite,
  parseOrganizationUnitWrite,
  parsePersonnelWrite
} from "../src/routes/organizationWriteValidation";

describe("Organization Chart server-side write validation", () => {
  it("accepts a flexible unit kind without allowing system-owned metadata", () => {
    expect(parseOrganizationUnitWrite({ unitKind: "work", parentContentId: "division", sortOrder: 2 })).toEqual({
      unitKind: "work",
      parentContentId: "division",
      sortOrder: 2
    });
    expect(() => parseOrganizationUnitWrite({ unitKind: "work", revision: 6 })).toThrow(OrganizationInputError);
    expect(() => parseOrganizationUnitWrite({ unitKind: "work", type: "page" })).toThrow(/protected field/);
    expect(() => parseOrganizationUnitWrite({ unitKind: "work", parentContentId: "../../secret" })).toThrow();
    expect(() => parseOrganizationUnitWrite({ unitKind: "work", sortOrder: -2 })).toThrow();
  });

  it("allows one canonical person profile and defaults contact visibility to private", () => {
    expect(parsePersonnelWrite({ displayName: " Staff Member " })).toMatchObject({
      displayName: "Staff Member",
      publicEmail: "",
      publicPhone: "",
      showPublicEmail: false,
      showPublicPhone: false,
      educationQualifications: "",
      active: true,
      photoMediaId: null
    });
    expect(
      parsePersonnelWrite({
        displayName: "Staff Member",
        publicEmail: "staff@example.invalid",
        publicPhone: "0123456789",
        showPublicEmail: true,
        showPublicPhone: false
      })
    ).toMatchObject({
      showPublicEmail: true,
      showPublicPhone: false,
      publicEmail: "staff@example.invalid"
    });
  });

  it("accepts an empty or entered academic qualification but enforces size", () => {
    expect(parsePersonnelWrite({ displayName: "A" }).educationQualifications).toBe("");
    expect(
      parsePersonnelWrite({ displayName: "A", educationQualifications: "ปริญญาตรี" }).educationQualifications
    ).toBe("ปริญญาตรี");
    expect(() => parsePersonnelWrite({ displayName: "A", educationQualifications: "x".repeat(1001) })).toThrow(
      /educationQualifications/
    );
  });

  it("rejects injected role, user id, revision, invalid flags and malformed emails", () => {
    expect(() => parsePersonnelWrite({ displayName: "X", role: "admin" })).toThrow(/protected field/);
    expect(() => parsePersonnelWrite({ displayName: "X", id: "injected" })).toThrow(/protected field/);
    expect(() => parsePersonnelWrite({ displayName: "X", showPublicEmail: 1 })).toThrow(/showPublicEmail/);
    expect(() => parsePersonnelWrite({ displayName: "X", publicEmail: "not-an-email" })).toThrow(/publicEmail/);
    expect(() => parsePersonnelWrite({ displayName: "   " })).toThrow(/displayName/);
  });

  it("allows opt-in automatic append but rejects non-boolean flags", () => {
    expect(
      parseOrganizationPositionWrite({ unitContentId: "division", title: "Head", autoSortOrder: true }).autoSortOrder
    ).toBe(true);
    expect(
      parseOrganizationAssignmentWrite({ personnelId: "p1", positionId: "pos1", autoSortOrder: true }).autoSortOrder
    ).toBe(true);
    expect(() =>
      parseOrganizationPositionWrite({ unitContentId: "division", title: "Head", autoSortOrder: 1 })
    ).toThrow(/autoSortOrder/);
    expect(() =>
      parseOrganizationAssignmentWrite({ personnelId: "p1", positionId: "pos1", autoSortOrder: "true" })
    ).toThrow(/autoSortOrder/);
  });

  it("enforces position occupant limits and foreign-reference syntax", () => {
    expect(
      parseOrganizationPositionWrite({ unitContentId: "division", title: " Head ", occupantLimit: 2 })
    ).toMatchObject({ title: "Head", occupantLimit: 2, sortOrder: 0 });
    expect(() =>
      parseOrganizationPositionWrite({ unitContentId: "division", title: "Head", occupantLimit: 0 })
    ).toThrow(/occupantLimit/);
    expect(() =>
      parseOrganizationPositionWrite({ unitContentId: "division", title: "Head", occupantLimit: 2.5 })
    ).toThrow(/occupantLimit/);
    expect(() => parseOrganizationPositionWrite({ title: "Head" })).toThrow(/unitContentId/);
    expect(() => parseOrganizationPositionWrite({ unitContentId: "division", title: "Head", updatedAt: "" })).toThrow(
      /protected field/
    );
  });

  it("accepts manual assignment controls but rejects scheduling and protected fields", () => {
    const fields = { personnelId: "p-1", positionId: "pos-1" };
    expect(parseOrganizationAssignmentWrite(fields)).toMatchObject({
      ...fields,
      enabled: true,
      sortOrder: 0,
      dutyDetail: ""
    });
    expect(() => parseOrganizationAssignmentWrite({ ...fields, startsAt: "2026-10-10T00:00:00Z" })).toThrow(
      /protected field/
    );
    expect(() => parseOrganizationAssignmentWrite({ ...fields, endsAt: "" })).toThrow(/protected field/);
    expect(() => parseOrganizationAssignmentWrite({ ...fields, enabled: "true" })).toThrow(/enabled/);
    expect(() => parseOrganizationAssignmentWrite({ ...fields, createdAt: "forged" })).toThrow(/protected field/);
  });
});
