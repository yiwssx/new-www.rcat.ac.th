import { readPublishedOrganization } from "../db/organizationReadRepository";
import type { Env } from "../env";
import { json } from "../responses";

/**
 * ASVS 8.2.3: expose only published organization chains, active assignments
 * and explicitly opted-in personnel contact fields. Never return raw D1 rows.
 */
export async function publicOrganization(env: Env): Promise<Response> {
  const organization = await readPublishedOrganization(env);
  return json(organization, {
    headers: { "Cache-Control": "public, max-age=60" }
  });
}
