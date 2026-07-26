import { describe, expect, it } from "vitest";
import { CMS_CAPABILITIES, parseCmsCapabilityPayload } from "./capabilities";

describe("CMS capability registry", () => {
  it("contains exactly 44 unique capabilities without wildcard support", () => {
    expect(CMS_CAPABILITIES).toHaveLength(44);
    expect(new Set(CMS_CAPABILITIES).size).toBe(44);
    expect(CMS_CAPABILITIES).not.toContain("*" as never);
  });

  it("validates and sorts a server capability response", () => {
    expect(
      parseCmsCapabilityPayload({
        role: "editor",
        capabilities: ["content.update", "dashboard.read"]
      })
    ).toEqual({
      role: "editor",
      capabilities: ["content.update", "dashboard.read"]
    });
  });

  it.each([
    ["unknown", ["dashboard.read", "unknown.capability"]],
    ["duplicate", ["dashboard.read", "dashboard.read"]]
  ])("fails closed for %s capabilities", (_label, capabilities) => {
    expect(() => parseCmsCapabilityPayload({ role: "admin", capabilities })).toThrow(
      "CMS capability payload is invalid"
    );
  });
});
