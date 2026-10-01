// @vitest-environment node
import { describe, expect, it } from "vitest";
import { normalizeContentPublishAtForAction, resolveContentPublishAtForWrite } from "../src/routes/adminWrite";

const now = "2026-10-02T00:00:00.000Z";
const past = "2026-09-30T08:45:00.000Z";
const future = "2026-10-30T08:45:00.000Z";

describe("Worker-authoritative content publish time", () => {
  it("ignores a future client clock for a direct published create", () => {
    expect(resolveContentPublishAtForWrite("published", future, undefined, undefined, now)).toBe(now);
  });

  it("clamps a future client timestamp when draft content becomes published", () => {
    expect(resolveContentPublishAtForWrite("published", future, "draft", past, now)).toBe(now);
  });

  it("preserves an explicit valid past timestamp when draft content becomes published", () => {
    expect(resolveContentPublishAtForWrite("published", past, "draft", past, now)).toBe(past);
  });

  it("preserves the historical server-approved timestamp during published edits", () => {
    expect(resolveContentPublishAtForWrite("published", future, "published", past, now)).toBe(past);
  });

  it("repairs a legacy published future timestamp to Worker time", () => {
    expect(resolveContentPublishAtForWrite("published", future, "published", future, now)).toBe(now);
  });

  it("allows future timestamps only for scheduled content", () => {
    expect(resolveContentPublishAtForWrite("scheduled", future, "draft", past, now)).toBe(future);
    expect(() => resolveContentPublishAtForWrite("scheduled", past, "draft", past, now)).toThrow(
      "scheduled publishAt must be a valid future timestamp"
    );
    expect(() => resolveContentPublishAtForWrite("scheduled", "", "draft", past, now)).toThrow(
      "scheduled publishAt is required"
    );
  });

  it("does not retain future client timestamps on inactive content", () => {
    expect(resolveContentPublishAtForWrite("draft", future, "draft", future, now)).toBe("");
    expect(resolveContentPublishAtForWrite("review", future, "review", future, now)).toBe("");
  });

  it("clamps legacy future timestamps on the dedicated publish action", () => {
    expect(normalizeContentPublishAtForAction("publish", future, now)).toBe(now);
    expect(normalizeContentPublishAtForAction("publish", past, now)).toBe(past);
    expect(normalizeContentPublishAtForAction("unpublish", future, now)).toBe("");
  });
});
