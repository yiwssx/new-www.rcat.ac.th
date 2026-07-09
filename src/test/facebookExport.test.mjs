import { URL } from "node:url";
import { describe, expect, it, vi } from "vitest";
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

  it("splits the requested date range into chunked Graph API calls", async () => {
    const requestedUrls = [];
    const fetchImpl = async (url) => {
      requestedUrls.push(url);
      return jsonResponse({ data: [] });
    };

    const result = await exportFacebookPagePosts({
      token: "test-token",
      pageId: "100063746585360",
      graphVersion: "v25.0",
      since: "2023-01-01",
      until: "2023-02-28",
      chunkDays: 30,
      fetchImpl,
      now: () => new Date("2026-07-09T00:00:00.000Z")
    });

    expect(result).toMatchObject({
      source: "facebook-page",
      pageId: "100063746585360",
      since: "2023-01-01",
      until: "2023-02-28",
      chunkDays: 30,
      generatedAt: "2026-07-09T00:00:00.000Z",
      fieldsMode: "minimal",
      posts: [],
      errors: []
    });
    expect(requestedUrls).toHaveLength(2);
    expect(requestDateRange(requestedUrls[0])).toEqual(["2023-01-01", "2023-01-31"]);
    expect(requestDateRange(requestedUrls[1])).toEqual(["2023-02-01", "2023-02-28"]);
  });

  it("deduplicates posts by Facebook post id across chunk boundaries", async () => {
    let requestCount = 0;
    const fetchImpl = async () => {
      requestCount += 1;

      return jsonResponse({
        data:
          requestCount === 1
            ? [
                {
                  id: "100063746585360_duplicate",
                  message: "โพสต์ซ้ำจากช่วงแรก",
                  created_time: "2023-01-15T00:00:00+0000",
                  permalink_url: "https://www.facebook.com/100063746585360/posts/duplicate"
                }
              ]
            : [
                {
                  id: "100063746585360_duplicate",
                  message: "โพสต์ซ้ำจากช่วงถัดไป",
                  created_time: "2023-01-31T23:59:59+0000",
                  permalink_url: "https://www.facebook.com/100063746585360/posts/duplicate"
                },
                {
                  id: "100063746585360_unique",
                  message: "โพสต์ใหม่",
                  created_time: "2023-02-05T00:00:00+0000",
                  permalink_url: "https://www.facebook.com/100063746585360/posts/unique"
                }
              ]
      });
    };

    const result = await exportFacebookPagePosts({
      token: "test-token",
      pageId: "100063746585360",
      graphVersion: "v25.0",
      since: "2023-01-01",
      until: "2023-02-28",
      chunkDays: 30,
      fetchImpl
    });

    expect(result.posts.map((post) => post.id)).toEqual(["100063746585360_duplicate", "100063746585360_unique"]);
    expect(result.posts[0].message).toBe("โพสต์ซ้ำจากช่วงแรก");
  });

  it("retries Meta code 1 responses by lowering limit from 25 to 10", async () => {
    const requestedUrls = [];
    const fetchImpl = async (url) => {
      requestedUrls.push(url);

      if (requestedUrls.length === 1) {
        return jsonResponse(reduceDataError(), 500);
      }

      return jsonResponse({
        data: [
          {
            id: "100063746585360_1",
            message: "สำเร็จหลังลด limit",
            created_time: "2026-07-02T00:00:00+0000",
            permalink_url: "https://www.facebook.com/100063746585360/posts/1"
          }
        ]
      });
    };

    const result = await exportFacebookPagePosts({
      token: "test-token",
      pageId: "100063746585360",
      graphVersion: "v25.0",
      since: "2026-07-01",
      until: "2026-07-31",
      chunkDays: 30,
      fetchImpl
    });

    expect(requestLimits(requestedUrls)).toEqual(["25", "10"]);
    expect(result.posts.map((post) => post.id)).toEqual(["100063746585360_1"]);
    expect(result.errors).toEqual([]);
  });

  it("retries Meta code 1 responses by splitting a chunk after limit 10 fails", async () => {
    const requestedUrls = [];
    const fetchImpl = async (url) => {
      requestedUrls.push(url);

      if (requestedUrls.length === 1) {
        return jsonResponse(reduceDataError(), 500);
      }

      return jsonResponse({
        data: [
          {
            id: `100063746585360_${requestDateRange(url).join("_")}`,
            message: "สำเร็จหลังแบ่งช่วงวันที่",
            created_time: `${requestDateRange(url)[0]}T12:00:00+0000`,
            permalink_url: `https://www.facebook.com/100063746585360/posts/${requestedUrls.length}`
          }
        ]
      });
    };

    const result = await exportFacebookPagePosts({
      token: "test-token",
      pageId: "100063746585360",
      graphVersion: "v25.0",
      since: "2026-07-01",
      until: "2026-07-03",
      chunkDays: 30,
      limit: 10,
      fetchImpl
    });

    expect(requestDateRanges(requestedUrls)).toEqual([
      ["2026-07-01", "2026-07-03"],
      ["2026-07-01", "2026-07-02"],
      ["2026-07-03", "2026-07-03"]
    ]);
    expect(result.posts).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it("records very small chunk errors and continues exporting later chunks", async () => {
    const requestedUrls = [];
    const fetchImpl = async (url) => {
      requestedUrls.push(url);
      const [since] = requestDateRange(url);

      if (since === "2026-07-01") {
        return jsonResponse(reduceDataError(), 500);
      }

      return jsonResponse({
        data: [
          {
            id: `100063746585360_${since}`,
            message: "ช่วงถัดไปยังส่งออกได้",
            created_time: `${since}T12:00:00+0000`,
            permalink_url: `https://www.facebook.com/100063746585360/posts/${since}`
          }
        ]
      });
    };

    const result = await exportFacebookPagePosts({
      token: "test-token",
      pageId: "100063746585360",
      graphVersion: "v25.0",
      since: "2026-07-01",
      until: "2026-07-03",
      chunkDays: 1,
      limit: 10,
      fetchImpl
    });

    expect(result.posts.map((post) => post.id)).toEqual(["100063746585360_2026-07-02", "100063746585360_2026-07-03"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      since: "2026-07-01",
      until: "2026-07-01",
      limit: 10,
      code: 1
    });
    expect(JSON.stringify(result.errors)).not.toContain("test-token");
  });

  it("uses minimal default fields without attachments", async () => {
    const requestedUrls = [];
    const fetchImpl = async (url) => {
      requestedUrls.push(url);
      return jsonResponse({ data: [] });
    };

    await exportFacebookPagePosts({
      token: "test-token",
      pageId: "100063746585360",
      graphVersion: "v25.0",
      since: "2026-07-01",
      until: "2026-07-31",
      fetchImpl
    });

    expect(requestFields(requestedUrls[0])).toBe(
      "id,message,story,created_time,permalink_url,full_picture,status_type"
    );
    expect(requestFields(requestedUrls[0])).not.toContain("attachments");
    expect(requestLimits(requestedUrls)).toEqual(["25"]);
  });

  it("adds the attachments field only when includeAttachments is enabled", async () => {
    const requestedUrls = [];
    const fetchImpl = async (url) => {
      requestedUrls.push(url);
      return jsonResponse({ data: [] });
    };

    const result = await exportFacebookPagePosts({
      token: "test-token",
      pageId: "100063746585360",
      graphVersion: "v25.0",
      since: "2026-07-01",
      until: "2026-07-31",
      includeAttachments: true,
      fetchImpl
    });

    expect(result.fieldsMode).toBe("attachments");
    expect(requestFields(requestedUrls[0])).toContain("attachments{media,type,url,subattachments}");
  });

  it("logs chunk progress without printing the access token", async () => {
    const logger = { log: vi.fn() };

    await exportFacebookPagePosts({
      token: "test-token",
      pageId: "100063746585360",
      graphVersion: "v25.0",
      since: "2026-07-01",
      until: "2026-07-31",
      chunkDays: 30,
      fetchImpl: async () => jsonResponse({ data: [] }),
      logger
    });

    const output = logger.log.mock.calls.flat().join("\n");

    expect(output).toContain("Exporting chunk 2026-07-01 to 2026-07-31 ...");
    expect(output).toContain("Fetched 0 posts");
    expect(output).not.toContain("test-token");
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

function reduceDataError() {
  return {
    error: {
      code: 1,
      message: "Please reduce the amount of data you're asking for, then retry your request"
    }
  };
}

function requestDateRange(url) {
  const searchParams = new URL(url).searchParams;

  return [dateFromUnixSeconds(searchParams.get("since")), dateFromUnixSeconds(searchParams.get("until"))];
}

function requestDateRanges(urls) {
  return urls.map((url) => requestDateRange(url));
}

function requestLimits(urls) {
  return urls.map((url) => new URL(url).searchParams.get("limit"));
}

function requestFields(url) {
  return new URL(url).searchParams.get("fields");
}

function dateFromUnixSeconds(value) {
  return new Date(Number(value) * 1000).toISOString().slice(0, 10);
}
