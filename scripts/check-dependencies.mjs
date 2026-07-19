import { spawnSync } from "node:child_process";

const auditLevelArgument = process.argv.find((argument) => argument.startsWith("--audit-level="));
const auditLevel = auditLevelArgument?.split("=", 2)[1] || "high";
const npmExecPath = process.env.npm_execpath;
const command = npmExecPath ? process.execPath : process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const commandPrefix = npmExecPath ? [npmExecPath] : [];

function runPnpm(args) {
  const result = spawnSync(command, [...commandPrefix, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });

  if (result.error) {
    console.error(`Unable to run pnpm ${args.join(" ")}: ${result.error.message}`);
    return 1;
  }

  return result.status ?? 1;
}

console.log("Dependency freshness report (informational):");
const outdatedExitCode = runPnpm(["outdated"]);

console.log(`Dependency audit report (enforced at ${auditLevel} severity):`);
const auditExitCode = runPnpm(["audit", "--audit-level", auditLevel]);

console.log(
  `Dependency check summary: outdated exit ${outdatedExitCode}; audit exit ${auditExitCode}; enforced severity ${auditLevel}.`
);

process.exitCode = auditExitCode;
