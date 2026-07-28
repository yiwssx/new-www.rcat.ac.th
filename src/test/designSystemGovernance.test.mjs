// @vitest-environment node

import { describe, expect, it } from "vitest";
import { inspectDesignSystemSource, runDesignSystemGovernance } from "../../scripts/check-design-system-governance.mjs";

describe("design-system governance", () => {
  it("accepts the repository design-system architecture", async () => {
    await expect(runDesignSystemGovernance()).resolves.toEqual([]);
  });

  it.each([
    ["broad icon barrel", 'import { Search } from "@mui/icons-material";', /broad/],
    ["hard-coded brand color", 'const sx = { color: "#2c7a3f" };', /hard-coded color/],
    ["duplicate focus", 'const sx = { "&:focus-visible": { outline: "none" } };', /focus-visible/],
    ["important override", 'const sx = { color: "red !important" };', /!important/],
    ["Public/Admin boundary", 'import Thing from "../../admin/pages/Thing";', /Admin\/Auth/]
  ])("rejects %s violations", (_name, source, expected) => {
    expect(inspectDesignSystemSource("src/public/components/Violation.tsx", source).join("\n")).toMatch(expected);
  });
});
