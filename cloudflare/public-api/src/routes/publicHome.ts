import { createPublicHomeSnapshot } from "../adapters/publicHomeAdapter";
import { listFeaturedContentRows } from "../db/contentRepository";
import { listPublishedDocumentRows } from "../db/documentsRepository";
import { listPublishedHomeSectionRows } from "../db/homeRepository";
import { listPublishedProgramRows } from "../db/programsRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const RESOURCE = "public-home";
const PHASE = "M17-B";

export async function publicHome(env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: RESOURCE,
      phase: PHASE
    });
  }

  try {
    const [sections, featuredContent, featuredDocuments, programs] = await Promise.all([
      listPublishedHomeSectionRows(env),
      listFeaturedContentRows(env),
      listPublishedDocumentRows(env),
      listPublishedProgramRows(env)
    ]);

    return json(
      createPublicHomeSnapshot({
        sections,
        featuredContent,
        featuredDocuments,
        programs
      })
    );
  } catch {
    return jsonError("Unable to load public-home", 500, {
      resource: RESOURCE,
      phase: PHASE
    });
  }
}
