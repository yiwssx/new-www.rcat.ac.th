import fs from "node:fs";

function patch(file, from, to) {
  let source = fs.readFileSync(file, "utf8");
  if (!source.includes(from)) throw new Error(`Missing post-fix source in ${file}`);
  source = source.replace(from, to);
  fs.writeFileSync(file, source);
}

patch(
  "cloudflare/public-api/src/adapters/publicContentAdapter.ts",
  'import type {\n  PublicContentDetailSnapshotContract,\n  PublicContentItemContract,\n  PublicContentListSnapshotContract\n} from "../contracts/publicContent";',
  'import type {\n  PublicContentDetailSnapshotContract,\n  PublicContentItemContract,\n  PublicContentListSnapshotContract,\n  PublicContentSummaryContract\n} from "../contracts/publicContent";'
);

patch(
  "cloudflare/public-api/src/adapters/publicContentAdapter.ts",
  'export function mapContentSummaryRowToPublicContentItem(row: PublicContentSummaryReadRow) {\n  return mapContentRowToPublicContentItem({ ...(row as PublicContentReadRow), body_snapshot: "" });\n}',
  'export function mapContentSummaryRowToPublicContentItem(\n  row: PublicContentSummaryReadRow\n): PublicContentSummaryContract {\n  const summary = {\n    ...mapContentRowToPublicContentItem({ ...(row as PublicContentReadRow), body_snapshot: "" })\n  } as Partial<PublicContentItemContract>;\n  delete summary.body;\n  delete (summary as Partial<PublicContentItemContract> & { content?: string }).content;\n  return summary as PublicContentSummaryContract;\n}'
);

patch(
  "cloudflare/public-api/test/publicReadCoreRoutes.test.ts",
  '      items: [\n        expect.objectContaining({\n          slug: "sample-news",\n          type: "news",\n          status: "published",\n          owner: "",\n          body: "Fake local-only public content body.",\n          content: "Fake local-only public content body."\n        })\n      ]\n    });\n    expect(payload.media).toEqual([expect.objectContaining({ id: "sample-media-001" })]);',
  '      items: [\n        expect.objectContaining({\n          slug: "sample-news",\n          type: "news",\n          status: "published",\n          owner: ""\n        })\n      ]\n    });\n    const listedItem = (payload.items as Array<Record<string, unknown>>)[0];\n    expect(listedItem).not.toHaveProperty("body");\n    expect(listedItem).not.toHaveProperty("content");\n    expect(payload.media).toEqual([expect.objectContaining({ id: "sample-media-001" })]);'
);

patch(
  "cloudflare/public-api/test/publicReadCoreRoutes.test.ts",
  '    expect(found.payload).toMatchObject({\n      item: {\n        id: "sample-news-001",\n        slug: "sample-news",\n        title: "Sample public news",\n        type: "news",\n        status: "published",\n        owner: "",\n        summary: "Fake local-only news summary.",\n        body: "Fake local-only public content body.",\n        content: "Fake local-only public content body.",\n        category: "news",\n        publishedAt: "2026-02-01T00:00:00.000Z",\n        updatedAt: "2026-02-02T00:00:00.000Z"\n      }\n    });',
  '    expect(found.payload).toMatchObject({\n      item: {\n        id: "sample-news-001",\n        slug: "sample-news",\n        title: "Sample public news",\n        type: "news",\n        status: "published",\n        owner: "",\n        summary: "Fake local-only news summary.",\n        body: "Fake local-only public content body.",\n        content: "Fake local-only public content body.",\n        category: "news",\n        publishedAt: "2026-02-01T00:00:00.000Z",\n        updatedAt: "2026-02-02T00:00:00.000Z"\n      },\n      media: [expect.objectContaining({ id: "sample-media-001" })]\n    });'
);

patch(
  "cloudflare/public-api/test/publicReadCoreRoutes.test.ts",
  '    expect(payload).toMatchObject({\n      query: "news",\n      siteSettings: expect.any(Object),\n      homepageSettings: expect.any(Object),\n      displaySettings: expect.any(Object),\n      menu: expect.any(Array),\n      items: [expect.objectContaining({ slug: "sample-news", type: "news", status: "published" })]\n    });\n    expectGeneratedAt(payload);',
  '    expect(payload).toMatchObject({\n      query: "news",\n      siteSettings: expect.any(Object),\n      homepageSettings: expect.any(Object),\n      displaySettings: expect.any(Object),\n      menu: expect.any(Array),\n      items: [expect.objectContaining({ slug: "sample-news", type: "news", status: "published" })]\n    });\n    const searchItem = (payload.items as Array<Record<string, unknown>>)[0];\n    expect(searchItem).not.toHaveProperty("body");\n    expect(searchItem).not.toHaveProperty("content");\n    expectGeneratedAt(payload);'
);
