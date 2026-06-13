import { createPublicVisitorStatsSnapshot } from "../adapters/publicVisitorStatsAdapter";
import { listVisitorDailyStatsRows } from "../db/visitorStatsRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const RESOURCE = "visitor-stats";
const PHASE = "M17-B";

export async function publicVisitorStats(env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: RESOURCE,
      phase: PHASE
    });
  }

  try {
    const rows = await listVisitorDailyStatsRows(env);
    return json(createPublicVisitorStatsSnapshot(rows));
  } catch {
    return jsonError("Unable to load visitor-stats", 500, {
      resource: RESOURCE,
      phase: PHASE
    });
  }
}
