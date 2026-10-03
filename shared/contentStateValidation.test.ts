import { describe, expect, it } from "vitest";
import { isValidFutureSchedule, normalizeUnpublishAt, validateEditorialTransition } from "./contentStateValidation";

describe("shared content state and date validation", () => {
  it("preserves editorial transition rules", () => {
    expect(validateEditorialTransition("draft", "review")).toMatchObject({ ok: true, status: "review" });
    expect(validateEditorialTransition("published", "draft")).toMatchObject({ ok: false, status: 409 });
  });

  it("normalizes valid ISO dates and rejects invalid values", () => {
    expect(normalizeUnpublishAt("2026-10-03T00:00:00.000Z")).toBe("2026-10-03T00:00:00.000Z");
    expect(normalizeUnpublishAt("not-a-date")).toBeNull();
    expect(isValidFutureSchedule("2026-10-04T00:00:00.000Z", new Date("2026-10-03T00:00:00.000Z"))).toBe(true);
    expect(isValidFutureSchedule("2026-10-02T00:00:00.000Z", new Date("2026-10-03T00:00:00.000Z"))).toBe(false);
  });
});
