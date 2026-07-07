import { spawn } from "node:child_process";

const existingNodeOptions = process.env.NODE_OPTIONS ?? "";
const disableNodeWebStorageOption = "--no-experimental-webstorage";
const nodeOptions = existingNodeOptions.includes(disableNodeWebStorageOption)
  ? existingNodeOptions
  : `${existingNodeOptions} ${disableNodeWebStorageOption}`.trim();
const vitestArgs = ["exec", "vitest", ...process.argv.slice(2)];

const command =
  process.platform === "win32"
    ? [process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", ["pnpm", ...vitestArgs].map(quoteForCmd).join(" ")]]
    : ["pnpm", vitestArgs];

const child = spawn(command[0], command[1], {
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions
  },
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

function quoteForCmd(value) {
  if (/^[A-Za-z0-9_./:=*-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/(["^&|<>%])/g, "^$1")}"`;
}
