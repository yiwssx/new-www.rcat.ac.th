import { createPublicProgramListSnapshot } from "../adapters/publicProgramsAdapter";
import { createPublicMetadata } from "../adapters/publicMetadataAdapter";
import { listPublishedProgramRows } from "../db/programsRepository";
import { readPublicMediaRowsByIds, readPublicShellMetadataRows } from "../db/publicMetadataRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const RESOURCE = "program";
const PHASE = "M17-B";

function collectProgramMediaIds(rows: Awaited<ReturnType<typeof listPublishedProgramRows>>) {
  const ids = new Set<string>();

  rows.forEach((row) => {
    if (row.featured_media_id) {
      ids.add(row.featured_media_id);
    }

    try {
      const parsed: unknown = JSON.parse(row.media_ids_json || "[]");
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => {
          const normalized = String(id || "").trim();
          if (normalized) {
            ids.add(normalized);
          }
        });
      }
    } catch {
      // Malformed legacy media metadata should not force a full media-table scan.
    }
  });

  return [...ids];
}

export async function publicPrograms(env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: RESOURCE,
      phase: PHASE
    });
  }

  try {
    const [rows, shellRows] = await Promise.all([listPublishedProgramRows(env), readPublicShellMetadataRows(env)]);
    const media = await readPublicMediaRowsByIds(env, collectProgramMediaIds(rows));
    const metadata = createPublicMetadata({
      ...shellRows,
      media,
      carouselSlides: [],
      externalServices: [],
      events: []
    });

    return json(createPublicProgramListSnapshot(rows, metadata));
  } catch {
    return jsonError("Unable to load program", 500, {
      resource: RESOURCE,
      phase: PHASE
    });
  }
}
