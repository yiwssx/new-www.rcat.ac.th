// Last-resort read-only release gate when both Vercel GitHub reporting channels are stale.
// The live canonical HTTPS origin must serve the manifest generated during its Vercel build.
import { pathToFileURL } from "node:url";
import {
  RELEASE_PATH,
  verifyProductionReleaseManifest
} from "./production-release-manifest.mjs";

const ORIGIN = "https://www.rcat.ac.th";

export async function inspectLiveProductionRelease({ sha, read = fetch }) {
  // Never follow redirects, accept an arbitrary origin, or rely on a 200 alone.
  if (!/^[0-9a-f]{40}$/.test(sha || "")) return "failure";
  let response;
  try {
    response = await read(`${ORIGIN}${RELEASE_PATH}?sha=${sha}`, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(6000)
    });
  } catch {
    return "pending";
  }
  if (!response || response.status !== 200) return "pending";
  const type = response.headers?.get("content-type") ?? "";
  const cache = response.headers?.get("cache-control") ?? "";
  if (!/^application\/json(?:\s*;|\s*$)/i.test(type) || !/\bno-store\b/i.test(cache)) return "failure";
  try {
    const raw = await response.text();
    if (raw.length > 2048) return "failure";
    return verifyProductionReleaseManifest(JSON.parse(raw), sha);
  } catch {
    return "failure";
  }
}

async function main() {
  const result = await inspectLiveProductionRelease({ sha: process.env.TARGET_SHA });
  if (result === "ready") console.log("Canonical production HTTPS origin attests to the exact main commit SHA.");
  if (result === "pending") console.log("Production release attestation is not available for this SHA yet.");
  if (result === "failure") console.error("Production release attestation failed integrity checks.");
  process.exitCode = { ready: 0, pending: 11, failure: 1 }[result] ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Production release attestation failed closed: ${error.message}`);
    process.exitCode = 1;
  });
}
