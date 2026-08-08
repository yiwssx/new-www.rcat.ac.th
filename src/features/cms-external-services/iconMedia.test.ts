import { describe, expect, it } from "vitest";
import {
  createExternalServiceMediaIconKey,
  getExternalServiceIconMediaId,
  normalizeExternalServiceIconValue
} from "./iconMedia";

describe("E-Service media icon references", () => {
  it("round-trips a media id through the icon value", () => {
    const iconKey = createExternalServiceMediaIconKey("media-icon-1");

    expect(iconKey).toBe("media:media-icon-1");
    expect(getExternalServiceIconMediaId(iconKey)).toBe("media-icon-1");
  });

  it("uses Link as the default when no uploaded media image is selected", () => {
    expect(createExternalServiceMediaIconKey(" ")).toBe("link");
    expect(normalizeExternalServiceIconValue(undefined)).toBe("link");
    expect(normalizeExternalServiceIconValue("apps")).toBe("link");
    expect(normalizeExternalServiceIconValue("media:")).toBe("link");
  });

  it("preserves a valid media reference while normalizing whitespace", () => {
    expect(normalizeExternalServiceIconValue(" media:icon-2 ")).toBe("media:icon-2");
  });
});
