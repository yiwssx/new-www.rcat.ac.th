import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  [
    "scripts/check-dependencies.mjs",
    "--audit-level=high",
    "--prod-audit-level=moderate",
  ],
  {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  },
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.error) {
  console.error(
    `Dependency CI wrapper failed to launch checks: ${result.error.message}`,
  );
  process.exitCode = 1;
} else {
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const summary = output.match(
    /Dependency check summary: manifest=(\d+); peers=(\d+); audit=(\d+); productionAudit=(\d+); documentationFreshness=([^;]+); outdatedInformational=([^.]*)\./u,
  );

  if (!summary) {
    console.error(
      "Dependency CI wrapper could not verify the dependency-check summary; failing closed.",
    );
    process.exitCode = 1;
  } else {
    const [, manifest, peers, audit, productionAudit, documentationFreshness] =
      summary;
    const blockingChecksPassed = [
      manifest,
      peers,
      audit,
      productionAudit,
    ].every((value) => value === "0");

    if (!blockingChecksPassed) {
      console.error(
        "Dependency CI blocking checks failed; documentation freshness cannot bypass them.",
      );
      process.exitCode = 1;
    } else if (documentationFreshness !== "0") {
      console.log(
        "Dependency snapshot freshness is non-blocking in CI; manifest, peer, full audit, and production audit checks all passed.",
      );
      process.exitCode = 0;
    } else {
      process.exitCode = result.status === 0 ? 0 : 1;
    }
  }
}
