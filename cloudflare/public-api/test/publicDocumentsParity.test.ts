import { describe, expect, it } from "vitest";
import { createPublicDocumentListSnapshot } from "../src/adapters/publicDocumentsAdapter";
import type { DocumentRow } from "../src/db/schema";
import worker from "../src/index";
import appsScriptSnapshot from "./fixtures/publicDocuments/appsScriptSnapshot.sample.json";
import d1Rows from "./fixtures/publicDocuments/d1Rows.sample.json";
import {
  assertNoForbiddenProductionUrls,
  assertNoInternalD1Fields,
  assertPublicDocumentListParity,
  assertPublicDocumentListSnapshotShape
} from "./helpers/publicDocumentsParity";

function createMockDb(rows: DocumentRow[], options: { reject?: boolean } = {}) {
  return {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all<T>() {
          if (options.reject) {
            throw new Error("D1 internal test failure");
          }

          return {
            results: rows as T[],
            success: true
          };
        }
      };
    }
  } as unknown as D1Database;
}

async function readJson(response: Response) {
  return response.json() as Promise<unknown>;
}

describe("M3.1 public-document-list parity", () => {
  const rows = d1Rows as DocumentRow[];

  it("maps equivalent D1 rows to the Apps Script-style fixture exactly", () => {
    const actual = createPublicDocumentListSnapshot(rows, new Date(appsScriptSnapshot.generatedAt));

    assertPublicDocumentListParity(actual, appsScriptSnapshot);
  });

  it("returns Worker route item data matching the Apps Script-style fixture", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/documents"), {
      DB: createMockDb(rows)
    });
    const actual = await readJson(response);

    expect(response.status).toBe(200);
    assertPublicDocumentListSnapshotShape(actual);
    assertPublicDocumentListParity(
      {
        ...(actual as typeof appsScriptSnapshot),
        generatedAt: appsScriptSnapshot.generatedAt
      },
      appsScriptSnapshot
    );
  });

  it("uses only the exact public top-level and item keys", () => {
    assertPublicDocumentListSnapshotShape(appsScriptSnapshot);
  });

  it("does not leak snake_case D1 fields", () => {
    assertNoInternalD1Fields(appsScriptSnapshot);
  });

  it("does not leak internal fields like status or sampleOnly", () => {
    assertNoInternalD1Fields(appsScriptSnapshot);
  });

  it("does not contain forbidden production URLs", () => {
    assertNoForbiddenProductionUrls(appsScriptSnapshot);
  });

  it("accepts an empty list as a valid PublicDocumentListSnapshot", () => {
    assertPublicDocumentListSnapshotShape({
      items: [],
      generatedAt: "2026-05-27T00:00:00.000Z"
    });
  });

  it("keeps missing DB as a 503 error, not a parity response", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/documents"), {});
    const payload = await readJson(response);

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      error: "D1 DB binding is not configured",
      resource: "public-document-list",
      phase: "M3"
    });
  });

  it("keeps D1 failures as safe 500 errors, not parity responses", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/documents"), {
      DB: createMockDb(rows, { reject: true })
    });
    const payload = await readJson(response);

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: "Unable to load public-document-list",
      resource: "public-document-list",
      phase: "M3"
    });
    expect(JSON.stringify(payload)).not.toMatch(/D1 internal test failure|stack/i);
  });
});
