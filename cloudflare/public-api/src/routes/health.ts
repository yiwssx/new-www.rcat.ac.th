import type { Env } from "../env";
import { json } from "../responses";

export function health(env: Env) {
  return json({
    ok: true,
    service: "rcat-public-api",
    version: env.PUBLIC_API_VERSION?.trim() || "m1-skeleton",
    timestamp: new Date().toISOString()
  });
}
