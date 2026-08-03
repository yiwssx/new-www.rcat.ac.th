import { createPublicMetadata } from "../adapters/publicMetadataAdapter";
import type { PublicShellSnapshotContract } from "../contracts/publicShell";
import { readPublicShellMetadataRows } from "../db/publicMetadataRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const RESOURCE = "public-shell";

export async function publicShell(env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, { resource: RESOURCE });
  }

  try {
    const rows = await readPublicShellMetadataRows(env);
    const metadata = createPublicMetadata({
      ...rows,
      media: [],
      carouselSlides: [],
      externalServices: [],
      events: []
    });
    const payload: PublicShellSnapshotContract = {
      siteSettings: metadata.siteSettings,
      homepageSettings: metadata.homepageSettings,
      displaySettings: metadata.displaySettings,
      menu: metadata.menu,
      generatedAt: new Date().toISOString()
    };

    return json(payload);
  } catch {
    return jsonError("Unable to load public-shell", 500, { resource: RESOURCE });
  }
}
