import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyDeployment, inspectDeployment } from "./check-vercel-github-deployment.mjs";

const SHA = "a".repeat(40);
const makeDeployment = (changes = {}) => ({
  id: 123, sha: SHA, environment: "Production", creator: { login: "vercel[bot]" }, ...changes
});
const success = { state: "success", environment_url: "https://www.rcat.ac.th" };

test("accepts only exact-SHA Vercel Production success with HTTPS URL", () => {
  assert.equal(classifyDeployment([makeDeployment()], { 123: [success] }, SHA, false), "ready");
  assert.equal(classifyDeployment([makeDeployment({ sha: "b".repeat(40) })], { 123: [success] }, SHA, false), "pending");
  assert.equal(classifyDeployment([makeDeployment({ environment: "Preview" })], { 123: [success] }, SHA, false), "pending");
  assert.equal(classifyDeployment([makeDeployment({ creator: { login: "other-bot" } })], { 123: [success] }, SHA, false), "pending");
  assert.equal(classifyDeployment([makeDeployment()], { 123: [{ state: "success" }] }, SHA, false), "failure");
});

test("never accepts stale successes, terminal failures or unexplained inactivity", () => {
  assert.equal(classifyDeployment([makeDeployment()], { 123: [{ state: "pending" }, success] }, SHA, false), "pending");
  assert.equal(classifyDeployment([makeDeployment()], { 123: [{ state: "failure" }] }, SHA, false), "failure");
  assert.equal(classifyDeployment([makeDeployment()], { 123: [{ state: "inactive", description: "Archived" }] }, SHA, true), "failure");
});

test("an ignored non-runtime build is accepted only when expected and provider-certified", () => {
  const ignored = { state: "inactive", description: "Skipped – Not affected" };
  assert.equal(classifyDeployment([makeDeployment()], { 123: [ignored] }, SHA, true), "ignored");
  assert.equal(classifyDeployment([makeDeployment()], { 123: [ignored] }, SHA, false), "failure");
});

test("GET deployment lookup binds the exact target SHA and only reads verified statuses", async () => {
  const requests = [];
  const state = await inspectDeployment({
    repo: "yiwssx/new-www.rcat.ac.th",
    sha: SHA,
    token: "synthetic-read-only-token",
    expectedIgnored: false,
    readJson: async (url) => {
      requests.push(url);
      if (url.includes("/statuses?")) return [success];
      return [makeDeployment(), makeDeployment({ id: 999, sha: "b".repeat(40) })];
    }
  });
  assert.equal(state, "ready");
  assert.equal(requests.length, 2);
  assert.match(requests[0], new RegExp("sha=" + SHA));
  assert.match(requests[1], /\/deployments\/123\/statuses/);
});

test("bad SHA, data shape and missing auth fail closed", async () => {
  await assert.rejects(inspectDeployment({
    repo: "yiwssx/new-www.rcat.ac.th", sha: "invalid", token: "x", readJson: async () => []
  }));
  await assert.rejects(inspectDeployment({
    repo: "yiwssx/new-www.rcat.ac.th", sha: SHA, token: "x", readJson: async () => ({})
  }));
});
