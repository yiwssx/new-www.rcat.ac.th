import { createPublicDocumentListSnapshot } from "../adapters/publicDocumentsAdapter";
import { listPublishedDocumentRows } from "../db/documentsRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const PUBLIC_DOCUMENT_LIST_RESOURCE = "public-document-list";
const PUBLIC_DOCUMENT_LIST_PHASE = "M3";

export async function publicDocuments(env: Env) {
  if (!env.DB) {
    return jsonError("D1 DB binding is not configured", 503, {
      resource: PUBLIC_DOCUMENT_LIST_RESOURCE,
      phase: PUBLIC_DOCUMENT_LIST_PHASE
    });
  }

  try {
    const rows = await listPublishedDocumentRows(env);
    return json(createPublicDocumentListSnapshot(rows));
  } catch {
    return jsonError("Unable to load public-document-list", 500, {
      resource: PUBLIC_DOCUMENT_LIST_RESOURCE,
      phase: PUBLIC_DOCUMENT_LIST_PHASE
    });
  }
}
