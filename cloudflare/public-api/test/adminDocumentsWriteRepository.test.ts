import { describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import {
  getDocumentById,
  getDocumentByIdAny,
  insertDocumentRow,
  listAdminDocumentRows,
  softDeleteDocumentRow,
  updateDocumentPublicationRow,
  updateDocumentRow
} from "../src/db/adminDocumentsWriteRepository";
import type { DocumentRow } from "../src/db/schema";

const documentRow: DocumentRow = {
  id: "doc-1",
  title: "College document",
  description: "",
  category: "forms",
  file_url: "https://files.example.invalid/form.pdf",
  file_name: "form.pdf",
  media_id: "",
  published_at: "",
  status: "draft",
  sort_order: 1,
  pinned: 0,
  updated_at: "2026-10-09T00:00:00.000Z",
  created_at: "2026-10-08T00:00:00.000Z",
  deleted_at: "",
  created_by: "admin",
  updated_by: "admin",
  revision: 4
};

function mockDb() {
  const calls: Array<{ sql: string; bindings: unknown[] }> = [];
  const run = vi.fn(async () => ({ meta: { changes: 1 } }));
  const first = vi.fn(async () => documentRow);
  const all = vi.fn(async () => ({ results: [documentRow] }));
  const db = {
    prepare(sql: string) {
      const call = { sql, bindings: [] as unknown[] };
      calls.push(call);
      return {
        bind(...args: unknown[]) {
          call.bindings = args;
          return this;
        },
        run,
        first,
        all
      };
    }
  };
  return { env: { DB: db } as unknown as Env, calls, run, first, all };
}

describe("Admin Documents D1 repository seam", () => {
  it("keeps read queries separated by deletion visibility", async () => {
    const { env, calls } = mockDb();

    await listAdminDocumentRows(env);
    await getDocumentById(env, "doc-1");
    await getDocumentByIdAny(env, "doc-1");

    expect(calls[0]?.sql).toContain("ORDER BY pinned DESC, sort_order ASC");
    expect(calls[1]?.sql).toContain("COALESCE(deleted_at, '') = ''");
    expect(calls[2]?.sql).not.toContain("COALESCE(deleted_at, '') = ''");
    expect(calls[1]?.bindings).toEqual(["doc-1"]);
    expect(calls[2]?.bindings).toEqual(["doc-1"]);
  });

  it("binds insert and revision-guarded updates without string interpolation of user values", async () => {
    const { env, calls, run } = mockDb();

    await insertDocumentRow(env, documentRow);
    await updateDocumentRow(env, documentRow, 4);
    await softDeleteDocumentRow(env, documentRow.id, "admin", documentRow.updated_at, 4);
    await updateDocumentPublicationRow(
      env,
      documentRow.id,
      "published",
      documentRow.updated_at,
      "admin",
      documentRow.updated_at,
      4
    );

    expect(run).toHaveBeenCalledTimes(4);
    expect(calls[0]?.sql).toContain("INSERT INTO documents");
    expect(calls[0]?.bindings).toContain(documentRow.title);
    expect(calls[1]?.sql).toContain("(? IS NULL OR revision = ?)");
    expect(calls[1]?.bindings.slice(-2)).toEqual([4, 4]);
    expect(calls[2]?.sql).toContain("deleted_at = ?");
    expect(calls[2]?.bindings.slice(-2)).toEqual([4, 4]);
    expect(calls[3]?.sql).toContain("revision = revision + 1");
    expect(calls[3]?.bindings.slice(-2)).toEqual([4, 4]);
  });
});
