import { describe, expect, it } from "vitest";
import {
  adminContentListQueryOptions,
  adminListQueryKeys,
  adminMediaListQueryOptions,
  getAdminPageAfterDelete
} from "./query";

describe("admin pagination query helpers", () => {
  it("includes pagination, search, filters, and sorting in a stable entity query key", () => {
    const options = adminContentListQueryOptions({
      page: 3,
      pageSize: 50,
      q: "ita",
      status: "published",
      sortBy: "updatedAt",
      sortDirection: "desc"
    });

    expect(options.queryKey).toEqual([
      "admin-lists",
      "content",
      {
        page: 3,
        pageSize: 50,
        q: "ita",
        status: "published",
        sortBy: "updatedAt",
        sortDirection: "desc"
      }
    ]);
    expect(options.placeholderData).toBeTypeOf("function");
    expect(adminListQueryKeys.entity("content")).toEqual(["admin-lists", "content"]);
  });

  it("normalizes media query keys with the 24-item default", () => {
    expect(adminMediaListQueryOptions({ type: "image" }).queryKey).toEqual([
      "admin-lists",
      "media",
      { type: "image", page: 1, pageSize: 24 }
    ]);
  });

  it("moves back only when deletion removes the final page", () => {
    expect(getAdminPageAfterDelete({ page: 3, pageSize: 25, totalItems: 51 })).toBe(2);
    expect(getAdminPageAfterDelete({ page: 3, pageSize: 25, totalItems: 60 })).toBe(3);
    expect(getAdminPageAfterDelete({ page: 1, pageSize: 25, totalItems: 1 })).toBe(1);
  });
});
