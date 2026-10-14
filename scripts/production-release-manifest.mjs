// Build-time public attestation of the exact Vercel Git deployment on the canonical origin.
// Public metadata only; never embed API tokens or values from application secrets.
const SHA_PATTERN = /^[0-9a-f]{40}$/;
export const RELEASE_PATH = "/rcat-release.json";
export const RELEASE_REPOSITORY = "yiwssx/new-www.rcat.ac.th";

export function createProductionReleaseManifest(env) {
  if (env.VERCEL_ENV !== "production") return null;
  const repository = `${env.VERCEL_GIT_REPO_OWNER || ""}/${env.VERCEL_GIT_REPO_SLUG || ""}`;
  const sha = env.VERCEL_GIT_COMMIT_SHA;
  if (
    env.VERCEL !== "1" ||
    env.VERCEL_GIT_PROVIDER !== "github" ||
    repository !== RELEASE_REPOSITORY ||
    env.VERCEL_GIT_COMMIT_REF !== "main" ||
    !SHA_PATTERN.test(sha || "")
  ) {
    throw new Error("Production release metadata is missing or does not match the trusted GitHub/main source");
  }
  return {
    schemaVersion: 1,
    provider: "vercel",
    environment: "production",
    repository,
    ref: "main",
    sha
  };
}

export function verifyProductionReleaseManifest(manifest, targetSha) {
  if (!SHA_PATTERN.test(targetSha || "")) return "failure";
  if (manifest?.sha !== targetSha) return "pending";
  if (
    manifest?.schemaVersion !== 1 ||
    manifest?.provider !== "vercel" ||
    manifest?.environment !== "production" ||
    manifest?.repository !== RELEASE_REPOSITORY ||
    manifest?.ref !== "main"
  ) {
    return "failure";
  }
  return "ready";
}
