import { describe, expect, it, vi } from "vitest";
import { refetchImportedFacebookPosts, sourceIdentityFromImportRow } from "./refetch-imported-facebook-posts.mjs";

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}

const facebookImportRow = {
  id: "facebook-post-1609435494524655-1639846248150246",
  slug: "facebook-1609435494524655-1639846248150246",
  template: "facebook-embed",
  owner: "facebook-import",
  created_by: "facebook-import"
};

describe("targeted facebook-import source refetch", () => {
  it("derives the exact Graph object id only from facebook-import provenance", () => {
    expect(sourceIdentityFromImportRow(facebookImportRow)).toEqual({
      pageId: "1609435494524655",
      postId: "1639846248150246",
      graphId: "1609435494524655_1639846248150246",
      sanitizedId: "1609435494524655-1639846248150246"
    });

    expect(
      sourceIdentityFromImportRow({
        ...facebookImportRow,
        owner: "admin",
        created_by: "admin"
      })
    ).toBeNull();
  });

  it("refetches the complete source message for existing imports and ignores unrelated content", async () => {
    const fullMessage = "ข้อความต้นฉบับเต็มจาก Facebook ".repeat(40);
    const fetchImpl = vi.fn(async (url) => {
      expect(String(url)).toContain("/1609435494524655_1639846248150246");
      expect(String(url)).not.toContain("/posts?");
      return response({
        id: "1609435494524655_1639846248150246",
        message: fullMessage,
        created_time: "2026-01-02T03:04:05+0000",
        permalink_url: "https://www.facebook.com/1609435494524655/posts/1639846248150246"
      });
    });

    const result = await refetchImportedFacebookPosts({
      d1Payload: [
        {
          results: [
            facebookImportRow,
            {
              id: "manual-news-1",
              slug: "manual-news-1",
              template: "default",
              owner: "admin",
              created_by: "admin"
            }
          ]
        }
      ],
      token: "test-token",
      fetchImpl,
      sleepImpl: async () => {}
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.requested).toBe(1);
    expect(result.recovered).toBe(1);
    expect(result.unavailable).toBe(0);
    expect(result.posts[0].message).toBe(fullMessage);
  });

  it("records an unavailable import instead of inventing source content", async () => {
    const result = await refetchImportedFacebookPosts({
      d1Payload: [{ results: [facebookImportRow] }],
      token: "test-token",
      maxAttempts: 1,
      fetchImpl: async () => response({ error: { code: 100, message: "Unsupported get request" } }, 400),
      sleepImpl: async () => {}
    });

    expect(result.posts).toHaveLength(0);
    expect(result.unavailable).toBe(1);
    expect(result.targetedRecovery.failures[0].graphId).toBe("1609435494524655_1639846248150246");
  });
});
