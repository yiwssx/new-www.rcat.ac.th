// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  readOriginalSlugFromDeleteSnapshot,
  validateEditorialTransition
} from "../src/routes/adminEditorialGovernance";

describe("CMS editorial governance", () => {
  it("allows only draft and review editorial transitions", () => {
    expect(validateEditorialTransition("draft", "review")).toEqual({ ok: true, status: "review" });
    expect(validateEditorialTransition("review", "draft")).toEqual({ ok: true, status: "draft" });
    expect(validateEditorialTransition("draft", "published")).toMatchObject({ ok: false, status: 400 });
  });

  it("requires published and scheduled content to leave the publication flow before editorial changes", () => {
    expect(validateEditorialTransition("published", "review")).toMatchObject({ ok: false, status: 409 });
    expect(validateEditorialTransition("scheduled", "draft")).toMatchObject({ ok: false, status: 409 });
  });

  it("restores the original slug only from a valid delete revision snapshot", () => {
    expect(readOriginalSlugFromDeleteSnapshot(JSON.stringify({ slug: "original-news" }))).toBe("original-news");
    expect(readOriginalSlugFromDeleteSnapshot(JSON.stringify({ slug: "__deleted__:content-1" }))).toBe("");
    expect(readOriginalSlugFromDeleteSnapshot("not-json")).toBe("");
  });
});
