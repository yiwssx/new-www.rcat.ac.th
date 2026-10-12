// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseOrganizationContentUnitWrite } from "../src/routes/organizationUnitValidation";

const NOW = "2026-10-10T08:00:00.000Z";
const required = { slug: "division-a", title: "Division A", unitKind: "division" };

describe("Organization CMS unit mutation validation", () => {
  it("defaults to draft and permits multi-level units with validated slugs", () => {
    expect(parseOrganizationContentUnitWrite(required, NOW)).toMatchObject({
      slug: "division-a",
      title: "Division A",
      unitKind: "division",
      status: "draft",
      parentContentId: null
    });
    expect(
      parseOrganizationContentUnitWrite(
        {
          ...required,
          slug: "ฝ่ายบริหาร-1",
          unitKind: "work",
          parentContentId: "organization-abc",
          sortOrder: 2
        },
        NOW
      )
    ).toMatchObject({ slug: "ฝ่ายบริหาร-1", unitKind: "work", sortOrder: 2 });
  });

  it("accepts per-unit rows and reporting links while rejecting invalid layouts", () => {
    const valid = {
      ...required,
      chartMode: "tree",
      chartLayout: {
        director: { level: 1, row: 1, order: 0, parentPositionId: null },
        head: { level: 2, row: 1, order: 0, parentPositionId: "director" }
      }
    };
    expect(parseOrganizationContentUnitWrite(valid, NOW)).toMatchObject({
      chartMode: "tree",
      chartLayout: valid.chartLayout
    });
    expect(parseOrganizationContentUnitWrite({ ...valid, chartMode: "rows" }, NOW).chartMode).toBe("rows");
    expect(parseOrganizationContentUnitWrite(required, NOW)).toMatchObject({
      chartMode: "cards",
      chartLayout: {}
    });
    expect(() => parseOrganizationContentUnitWrite({ ...required, chartMode: "invalid" }, NOW)).toThrow(/chartMode/);
    expect(() =>
      parseOrganizationContentUnitWrite(
        {
          ...valid,
          chartLayout: {
            director: { level: 1, row: 1, order: 0, parentPositionId: "head" },
            head: { level: 2, row: 1, order: 0, parentPositionId: "director" }
          }
        },
        NOW
      )
    ).toThrow(/higher level/);
    expect(() =>
      parseOrganizationContentUnitWrite(
        {
          ...valid,
          chartLayout: { outsider: { level: 1, row: 0, order: 0, parentPositionId: null } }
        },
        NOW
      )
    ).toThrow(/invalid chart row/);
  });

  it("blocks reserved routes and protected CMS-managed fields", () => {
    for (const slug of ["api", "admin", "organization", "../admin", "a/b", "slug?x"]) {
      expect(() => parseOrganizationContentUnitWrite({ ...required, slug }, NOW)).toThrow(/slug/);
    }
    for (const field of ["id", "revision", "contentRevision", "type", "updatedBy", "owner", "deletedAt"]) {
      expect(() => parseOrganizationContentUnitWrite({ ...required, [field]: "forged" }, NOW)).toThrow(
        /protected field/
      );
    }
  });

  it("guards scheduled publication, ISO instants and unpublish ordering", () => {
    expect(parseOrganizationContentUnitWrite({ ...required, status: "published" }, NOW)).toMatchObject({
      status: "published",
      publishAt: NOW
    });
    expect(() => parseOrganizationContentUnitWrite({ ...required, status: "scheduled" }, NOW)).toThrow(
      /future publishAt/
    );
    expect(() => parseOrganizationContentUnitWrite({ ...required, status: "scheduled", publishAt: NOW }, NOW)).toThrow(
      /future publishAt/
    );
    expect(
      parseOrganizationContentUnitWrite(
        { ...required, status: "scheduled", publishAt: "2026-10-11T00:00:00.000Z" },
        NOW
      )
    ).toMatchObject({ status: "scheduled" });
    expect(() =>
      parseOrganizationContentUnitWrite(
        {
          ...required,
          publishAt: "2026-10-11T00:00:00.000Z",
          unpublishAt: "2026-10-10T00:00:00.000Z"
        },
        NOW
      )
    ).toThrow(/unpublishAt/);
  });
});
