import { createPublicProgramListSnapshot } from "../adapters/publicProgramsAdapter";
import { createPublicMetadata } from "../adapters/publicMetadataAdapter";
import { listPublishedProgramRows } from "../db/programsRepository";
import { readPublicMetadataRows } from "../db/publicMetadataRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const RESOURCE = "program";
const PHASE = "M17-B";

export async function publicPrograms(env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: RESOURCE,
      phase: PHASE
    });
  }

  try {
    const [rows, metadataRows] = await Promise.all([listPublishedProgramRows(env), readPublicMetadataRows(env)]);
    return json(createPublicProgramListSnapshot(rows, createPublicMetadata(metadataRows)));
  } catch {
    return jsonError("Unable to load program", 500, {
      resource: RESOURCE,
      phase: PHASE
    });
  }
}
