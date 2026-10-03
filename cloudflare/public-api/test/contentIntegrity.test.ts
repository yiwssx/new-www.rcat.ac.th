// @vitest-environment node
import { describe, expect, it } from "vitest";

import { auditContentIntegrity } from "../src/contentIntegrity";
import type { ContentRow, DocumentRow, MenuItemRow } from "../src/db/schema";

const NOW = "2026-10-03T04:00:00.000Z";

function content(overrides: Partial<ContentRow> = {}): ContentRow {
  return {
    id: "content-1",
    slug: "example",
    type: "news",
    status: "published",
    owner: "Editorial",
    title: "Example",
    summary: "Summary",
    body_snapshot: "Body",
    category: "",
    tags_json: "[]",
    seo_title: "",
    seo_description: "",
    canonical_url: "",
    featured: 0,
    reading_minutes: 1,
    template: "standard",
    body_doc_id: "",
    body_doc_url: "",
    featured_media_id: "",
    media_ids_json: "[]",
    view_count: 0,
    last_viewed_at: "",
    updated_at: "2026-10-03T03:00:00.000Z",
    publish_at: "2026-10-03T03:00:00.000Z",
    created_at: "2026-10-03T02:00:00.000Z",
    deleted_at: "",
    created_by: "editor",
    updated_by: "editor",
    revision: 1,
    ...overrides
  };
}

function document(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: "document-1",
    title: "Document",
    description: "",
    category: "",
    file_url: "https://drive.google.com/file/d/example/view",
    file_name: "document.pdf",
    media_id: "",
    published_at: "2026-10-03T03:00:00.000Z",
    status: "published",
    sort_order: 0,
    pinned: 0,
    updated_at: "2026-10-03T03:00:00.000Z",
    created_at: "2026-10-03T02:00:00.000Z",
    deleted_at: "",
    created_by: "editor",
    updated_by: "editor",
    revision: 1,
    ...overrides
  };
}

function menu(overrides: Partial<MenuItemRow> = {}): MenuItemRow {
  return {
    id: "menu-1",
    parent_id: "",
    label: "Menu",
    href: "#",
    enabled: 1,
    sort_order: 0,
    children_json: "[]",
    updated_at: "2026-10-03T03:00:00.000Z",
    created_at: "2026-10-03T02:00:00.000Z",
    updated_by: "editor",
    revision: 1,
    ...overrides
  };
}

function codes(result: ReturnType<typeof auditContentIntegrity>) {
  return result.issues.map((item) => item.code);
}

describe("content integrity core rules", () => {
  it("accepts a clean read-only snapshot and intentional navigation placeholders", () => {
    const result = auditContentIntegrity({
      now: NOW,
      contents: [content()],
      documents: [document()],
      menuItems: [
        menu({ id: "placeholder-hash", href: "#" }),
        menu({ id: "placeholder-root", href: "/" }),
        menu({ id: "placeholder-root-hash", href: "/#" }),
        menu({ id: "content-link", href: "/content/example" })
      ]
    });

    expect(result).toMatchObject({
      ok: true,
      checked: { contents: 1, documents: 1, mediaAssets: 0, menuItems: 4 },
      issues: []
    });
  });

  it("detects duplicate or ambiguous active slugs after safe normalization", () => {
    const result = auditContentIntegrity({
      now: NOW,
      contents: [
        content({ id: "content-a", slug: "Admissions" }),
        content({ id: "content-b", slug: " admissions " }),
        content({ id: "content-deleted", slug: "ADMISSIONS", deleted_at: NOW })
      ]
    });

    expect(result.issues).toEqual([
      { code: "content-slug-duplicate", entity: "content", id: "content-a", field: "slug" },
      { code: "content-slug-duplicate", entity: "content", id: "content-b", field: "slug" }
    ]);
  });

  it("detects publication-state drift without treating an elapsed schedule as invalid", () => {
    const result = auditContentIntegrity({
      now: NOW,
      contents: [
        content({ id: "future-published", publish_at: "2026-10-04T00:00:00.000Z" }),
        content({ id: "invalid-published", publish_at: "not-a-date" }),
        content({ id: "invalid-scheduled", status: "scheduled", publish_at: "" }),
        content({ id: "elapsed-scheduled", status: "scheduled", publish_at: "2026-10-02T00:00:00.000Z" }),
        content({ id: "future-draft", status: "draft", publish_at: "2026-10-04T00:00:00.000Z" })
      ]
    });

    expect(codes(result)).toEqual([
      "content-inactive-future-publish-at",
      "content-publish-at-future",
      "content-publish-at-invalid",
      "content-publish-at-invalid"
    ]);
    expect(result.issues.some((item) => item.id === "elapsed-scheduled")).toBe(false);
  });

  it("detects malformed Facebook embed state and required publishable fields", () => {
    const result = auditContentIntegrity({
      now: NOW,
      contents: [
        content({
          id: "facebook",
          template: "facebook-embed",
          canonical_url: "https://www.facebook.com/rcat/posts/"
        }),
        content({ id: "required", status: "scheduled", owner: "", title: "", publish_at: "2026-10-04T00:00:00.000Z" }),
        content({ id: "invalid-type", type: "other" }),
        content({ id: "invalid-status", status: "archived" })
      ]
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        { code: "content-facebook-permalink-invalid", entity: "content", id: "facebook", field: "canonical_url" },
        { code: "content-required-field-missing", entity: "content", id: "required", field: "owner" },
        { code: "content-required-field-missing", entity: "content", id: "required", field: "title" },
        { code: "content-type-invalid", entity: "content", id: "invalid-type", field: "type" },
        { code: "content-status-invalid", entity: "content", id: "invalid-status", field: "status" }
      ])
    );
  });

  it("detects invalid content/document/media references using only locally verifiable identities", () => {
    const result = auditContentIntegrity({
      now: NOW,
      mediaAssets: [{ id: "media-ok" }],
      contents: [
        content({
          id: "references",
          body_doc_id: "doc-external-id",
          featured_media_id: "media-missing",
          media_ids_json: JSON.stringify(["media-ok", "media-missing"])
        }),
        content({ id: "invalid-reference-json", media_ids_json: "not-json" }),
        content({
          id: "invalid-document-url",
          body_doc_id: "doc-external-id",
          body_doc_url: "http://files.example.test/document"
        })
      ],
      documents: [
        document({ id: "document-media", media_id: "media-missing" }),
        document({ id: "document-url", file_url: "http://files.example.test/document.pdf" })
      ]
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        {
          code: "content-document-reference-incomplete",
          entity: "content",
          id: "references",
          field: "body_doc_id"
        },
        {
          code: "content-media-reference-missing",
          entity: "content",
          id: "references",
          field: "featured_media_id"
        },
        {
          code: "content-media-reference-missing",
          entity: "content",
          id: "references",
          field: "media_ids_json"
        },
        {
          code: "content-media-reference-invalid",
          entity: "content",
          id: "invalid-reference-json",
          field: "media_ids_json"
        },
        {
          code: "content-document-url-invalid",
          entity: "content",
          id: "invalid-document-url",
          field: "body_doc_url"
        },
        {
          code: "document-media-reference-missing",
          entity: "document",
          id: "document-media",
          field: "media_id"
        },
        {
          code: "document-file-url-invalid",
          entity: "document",
          id: "document-url",
          field: "file_url"
        }
      ])
    );
  });

  it("detects menu structural defects while preserving placeholder and static-route behavior", () => {
    const result = auditContentIntegrity({
      now: NOW,
      contents: [
        content({ id: "live", slug: "live" }),
        content({ id: "draft", slug: "draft", status: "draft", publish_at: "" })
      ],
      menuItems: [
        menu({ id: "hash", href: "#" }),
        menu({ id: "root", href: "/" }),
        menu({ id: "root-hash", href: "/#" }),
        menu({ id: "static", href: "/news" }),
        menu({ id: "live-link", href: "/content/live" }),
        menu({ id: "missing-content", href: "/content/missing" }),
        menu({ id: "draft-content", href: "/content/draft" }),
        menu({ id: "missing-parent", parent_id: "does-not-exist" }),
        menu({ id: "cycle-a", parent_id: "cycle-b" }),
        menu({ id: "cycle-b", parent_id: "cycle-a" }),
        menu({ id: "self", parent_id: "self" }),
        menu({ id: "unsafe", href: "javascript:alert(1)" })
      ]
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        { code: "menu-content-reference-missing", entity: "menu", id: "missing-content", field: "href" },
        { code: "menu-content-reference-not-public", entity: "menu", id: "draft-content", field: "href" },
        { code: "menu-parent-missing", entity: "menu", id: "missing-parent", field: "parent_id" },
        { code: "menu-parent-cycle", entity: "menu", id: "cycle-a", field: "parent_id" },
        { code: "menu-parent-cycle", entity: "menu", id: "cycle-b", field: "parent_id" },
        { code: "menu-parent-self-reference", entity: "menu", id: "self", field: "parent_id" },
        { code: "menu-href-invalid", entity: "menu", id: "unsafe", field: "href" }
      ])
    );
    expect(result.issues.some((item) => ["hash", "root", "root-hash", "static", "live-link"].includes(item.id))).toBe(
      false
    );
  });

  it("is deterministic, does not mutate input, and requires an explicit valid audit clock", () => {
    const snapshot = {
      now: NOW,
      contents: [content({ id: "b", slug: "same" }), content({ id: "a", slug: "SAME" })],
      menuItems: [menu({ id: "menu-z", href: "/content/missing" })]
    };
    const before = JSON.stringify(snapshot);
    const first = auditContentIntegrity(snapshot);
    const second = auditContentIntegrity(snapshot);

    expect(first).toEqual(second);
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(first.issues.map((item) => item.id)).toEqual(["a", "b", "menu-z"]);
    expect(() => auditContentIntegrity({ now: "invalid", contents: [] })).toThrow(
      "content integrity audit requires a valid now timestamp"
    );
  });
});
