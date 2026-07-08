import { createPublicEventListSnapshot } from "../adapters/publicEventsAdapter";
import { listPublicEventRows } from "../db/eventsRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const PUBLIC_EVENTS_RESOURCE = "public-events";
const PUBLIC_EVENTS_PHASE = "M21";

export async function publicEvents(env: Env) {
  if (!env.DB) {
    return jsonError("D1 DB binding is not configured", 503, {
      resource: PUBLIC_EVENTS_RESOURCE,
      phase: PUBLIC_EVENTS_PHASE
    });
  }

  try {
    const rows = await listPublicEventRows(env);
    return json(createPublicEventListSnapshot(rows));
  } catch {
    return jsonError("Unable to load public-events", 500, {
      resource: PUBLIC_EVENTS_RESOURCE,
      phase: PUBLIC_EVENTS_PHASE
    });
  }
}
