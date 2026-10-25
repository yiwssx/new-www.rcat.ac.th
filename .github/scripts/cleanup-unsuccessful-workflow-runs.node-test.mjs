import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execute = promisify(execFile);
const script = fileURLToPath(new URL("./cleanup-unsuccessful-workflow-runs.mjs", import.meta.url));
const expired = (id, conclusion = "failure", status = "completed") => ({
  id,
  conclusion,
  status,
  name: "Fixture",
  updated_at: new Date(Date.now() - 200 * 86400000).toISOString()
});

async function fixture({ pages = {}, deleteStatus = 204, listStatus = 200, dryRun = false }) {
  const deletes = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://fixture");
    assert.equal(request.headers.authorization, "Bearer fixture-only-token");
    if (request.method === "DELETE") {
      deletes.push(Number(url.pathname.split("/").at(-1)));
      response.writeHead(deleteStatus, { "content-type": "application/json" });
      response.end(deleteStatus === 204 ? "" : JSON.stringify({ message: "Fixture rejection" }));
      return;
    }
    const key = `${url.searchParams.get("status")}:${url.searchParams.get("page")}`;
    response.writeHead(listStatus, { "content-type": "application/json" });
    response.end(
      JSON.stringify(listStatus === 200 ? { workflow_runs: pages[key] || [] } : { message: "Fixture rejection" })
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const env = {
      ...process.env,
      GITHUB_TOKEN: "fixture-only-token",
      GITHUB_REPOSITORY: "fixture/repository",
      GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
      GITHUB_RUN_ID: "999",
      GITHUB_STEP_SUMMARY: "",
      DRY_RUN: String(dryRun)
    };
    try {
      const result = await execute(process.execPath, [script], { env });
      return { ...result, deletes, code: 0 };
    } catch (error) {
      return { stdout: error.stdout, stderr: error.stderr, deletes, code: error.code };
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test("deduplicates overlapping pages and preserves successes, active runs and the current run", async () => {
  const recent = { ...expired(4), updated_at: new Date().toISOString() };
  const firstPage = [
    expired(1),
    expired(3, "success"),
    expired(5, "failure", "in_progress"),
    expired(999),
    ...Array.from({ length: 96 }, () => recent)
  ];
  const result = await fixture({
    pages: { "failure:1": firstPage, "failure:2": [expired(1), expired(2)] }
  });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(result.deletes, [1, 2]);
  assert.match(result.stdout, /Deleted: 2/);
});

test("treats DELETE 404 for a listed target as already absent without claiming a deletion", async () => {
  const result = await fixture({ pages: { "failure:1": [expired(1)] }, deleteStatus: 404 });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(result.deletes, [1]);
  assert.match(result.stdout, /Deleted: 0/);
  assert.match(result.stdout, /Already absent: 1/);
});

test("does not swallow forbidden deletions or failed enumeration", async () => {
  const deletion = await fixture({ pages: { "failure:1": [expired(1)] }, deleteStatus: 403 });
  assert.equal(deletion.code, 1);
  assert.match(deletion.stderr, /GitHub API 403/);
  const listing = await fixture({ listStatus: 404 });
  assert.equal(listing.code, 1);
  assert.match(listing.stderr, /GitHub API 404/);
  assert.deepEqual(listing.deletes, []);
});

test("dry run enumerates eligible targets without any DELETE request", async () => {
  const result = await fixture({ pages: { "cancelled:1": [expired(7, "cancelled")] }, dryRun: true });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(result.deletes, []);
  assert.match(result.stdout, /Would delete workflow run 7/);
  assert.match(result.stdout, /Deleted: 0/);
});
