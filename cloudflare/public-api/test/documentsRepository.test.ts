import { describe, expect, it } from "vitest";
import { DOCUMENT_ROW_COLUMNS } from "../src/db/schema";
import { listPublishedDocumentRows } from "../src/db/documentsRepository";

describe("M3 documents repository", () => {
  it("queries published document rows with explicit columns and stable public ordering", async () => {
    const calls: Array<{ query: string; bindings: unknown[] }> = [];
    const db = {
      prepare(query: string) {
        const call = {
          query,
          bindings: [] as unknown[]
        };
        calls.push(call);

        return {
          bind(...values: unknown[]) {
            call.bindings.push(...values);
            return this;
          },
          async all() {
            return {
              results: [],
              success: true
            };
          }
        };
      }
    };

    await listPublishedDocumentRows({
      DB: db as unknown as D1Database
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.query).toContain(`SELECT ${DOCUMENT_ROW_COLUMNS.join(", ")}`);
    expect(calls[0]?.query).toMatch(/\bFROM\s+documents\b/i);
    expect(calls[0]?.query).toMatch(/\bWHERE\s+status\s*=\s*\?/i);
    expect(calls[0]?.query).toMatch(
      /\bORDER\s+BY\s+pinned\s+DESC,\s*sort_order\s+ASC,\s*published_at\s+DESC,\s*updated_at\s+DESC/i
    );
    expect(calls[0]?.query).not.toMatch(/SELECT\s+\*/i);
    expect(calls[0]?.bindings).toEqual(["published"]);
  });
});
