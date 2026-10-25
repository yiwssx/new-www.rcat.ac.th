// ASVS 15.2.1: keep the supported major bounded and each build reproducible.
export function validatePnpmRuntime(packageManager, engine, activeVersion) {
  const exact = /^pnpm@(10\.\d+\.\d+)$/.exec(String(packageManager || ""));
  return Boolean(exact && engine === "10.x" && activeVersion === exact[1]);
}
