import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tool = path.resolve(process.cwd(), "scripts/apps-script-release-tools.mjs");
const tempDirectories: string[] = [];

function tempFile(name: string, content: string) {
  const directory = mkdtempSync(path.join(tmpdir(), "rcat-p5g-"));
  tempDirectories.push(directory);
  const file = path.join(directory, name);
  writeFileSync(file, content);
  return file;
}

function run(...args: string[]) {
  return execFileSync(process.execPath, [tool, ...args], {
    encoding: "utf8",
  }).trim();
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Apps Script production release tools", () => {
  it("resolves exactly one existing deployment version", () => {
    const deployments = tempFile(
      "deployments.txt",
      [
        "2 Deployments.",
        "- head-deployment-id @HEAD",
        "- production-deployment-id-123456 @42 - production",
      ].join("\n"),
    );

    expect(
      run(
        "current-version",
        "--deployments",
        deployments,
        "--deployment-id",
        "production-deployment-id-123456",
      ),
    ).toBe("42");
  });

  it("parses the immutable version created by clasp", () => {
    const output = tempFile(
      "created-version.txt",
      "Creating a new version...\nCreated version 43.\n",
    );

    expect(run("created-version", "--file", output)).toBe("43");
  });

  it("rejects deployment drift after release", () => {
    const deployments = tempFile(
      "deployments.txt",
      "- production-deployment-id-123456 @42 - production\n",
    );

    expect(() =>
      run(
        "assert-deployment-version",
        "--deployments",
        deployments,
        "--deployment-id",
        "production-deployment-id-123456",
        "--version",
        "43",
      ),
    ).toThrow();
  });

  it("verifies the exact production media bridge health contract", () => {
    const health = tempFile(
      "health.json",
      JSON.stringify({
        ok: true,
        scope: "media-file-bridge",
        resources: [
          "media-upload-status",
          "media",
          "media-delete",
          "media-upload-chunk",
          "media-upload-start",
        ],
      }),
    );

    expect(run("verify-health", "--file", health)).toContain(
      "health contract verified",
    );
  });

  it("rejects a production project config with the example placeholder", () => {
    const project = tempFile(
      ".clasp.json",
      JSON.stringify({ scriptId: "PUT_YOUR_SCRIPT_ID_HERE", rootDir: "." }),
    );

    expect(() =>
      run(
        "validate-config",
        "--project",
        project,
        "--deployment-id",
        "production-deployment-id-123456",
      ),
    ).toThrow();
  });
});
