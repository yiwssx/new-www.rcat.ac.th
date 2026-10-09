import { listPublishedOrganizationUnits } from "../db/organizationReadRepository";
import type { Env } from "../env";
import { json } from "../responses";

/** Public endpoint intentionally contains no personnel contact fields or draft units. */
export async function publicOrganization(env: Env): Promise<Response> {
  const units = await listPublishedOrganizationUnits(env);
  return json(
    { items: units },
    {
      headers: { "Cache-Control": "public, max-age=60" }
    }
  );
}
