import { describe, expect, it } from "vitest";
import {
  isOrganizationUnitKind,
  isValidOrganizationAssignmentPeriod,
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

  it("requires canonical UTC dates and chronological assignment intervals", () => {
    expect(isValidOrganizationAssignmentPeriod("", "")).toBe(true);
    expect(isValidOrganizationAssignmentPeriod("2026-10-09T00:00:00.000Z", "")).toBe(true);
    expect(isValidOrganizationAssignmentPeriod("2026-10-09T00:00:00.000Z", "2026-10-10T00:00:00.000Z")).toBe(true);
    expect(isValidOrganizationAssignmentPeriod("", "2026-10-10T00:00:00.000Z")).toBe(false);
    expect(isValidOrganizationAssignmentPeriod("2026-10-10T00:00:00.000Z", "2026-10-09T00:00:00.000Z")).toBe(false);
    expect(isValidOrganizationAssignmentPeriod("tomorrow", "")).toBe(false);
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
