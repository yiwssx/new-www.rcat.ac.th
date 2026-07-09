import { describe, expect, it } from "vitest";
import { exportFacebookPagePosts } from "../../scripts/facebook/export-page-posts.mjs";

describe("Facebook Graph API page post export", () => {
  it("fails clearly when the page access token is missing", async () => {
    await expect(
      exportFacebookPagePosts({
        token: "",
        pageId: "100063746585360",
        graphVersion: "v25.0",
        since: "2023-01-01",
        until: "2026-07-31",
        fetchImpl: async () => {
          throw new Error("fetch should not run");
        }
      })
    ).rejects.toThrow(/META_PAGE_ACCESS_TOKEN.*ต้องตั้งค่า/su);
  });

  it("uses Graph API fields, follows paging, and filters posts to the requested date range", async () => {
    const requestedUrls = [];
    const fetchImpl = async (url) => {
      requestedUrls.push(url);

      if (requestedUrls.length === 1) {
        return jsonResponse({
          data: [
            {
              id: "100063746585360_1",
              message: "อยู่ในช่วงวันที่",
              created_time: "2024-01-01T00:00:00+0000",
              permalink_url: "https://www.facebook.com/100063746585360/posts/1"
            },
            {
              id: "100063746585360_0",
              message: "เก่านอกช่วงวันที่",
              created_time: "2022-12-31T23:59:59+0000",
              permalink_url: "https://www.facebook.com/100063746585360/posts/0"
            }
          ],
          paging: {
            next: "https://graph.facebook.com/v25.0/100063746585360/posts?after=next-page"
          }
        });
      }

      return jsonResponse({
        data: [
          {
            id: "100063746585360_2",
            story: "หน้าถัดไป",
            created_time: "2026-07-31T23:59:59+0000",
            permalink_url: "https://www.facebook.com/100063746585360/posts/2"
          }
        ]
      });
    };

    const result = await exportFacebookPagePosts({
      token: "test-token",
      pageId: "100063746585360",
      graphVersion: "v25.0",
      since: "2023-01-01",
      until: "2026-07-31",
      limit: 50,
      fetchImpl,
      now: () => new Date("2026-07-09T00:00:00.000Z")
    });

    expect(result).toMatchObject({
      source: "facebook-page",
      pageId: "100063746585360",
      since: "2023-01-01",
      until: "2026-07-31",
      generatedAt: "2026-07-09T00:00:00.000Z"
    });
    expect(result.posts.map((post) => post.id)).toEqual(["100063746585360_1", "100063746585360_2"]);
    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls[0]).toContain("fields=id%2Cmessage%2Cstory%2Ccreated_time%2Cpermalink_url");
    expect(requestedUrls[0]).toContain("limit=50");
    expect(requestedUrls[0]).toContain("access_token=test-token");
    expect(requestedUrls[1]).toContain("after=next-page");
  });
});

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}
