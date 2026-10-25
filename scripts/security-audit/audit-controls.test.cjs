"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { CHECKS, evaluate } = require("./audit-controls.cjs");

const fixture = () => new Map(CHECKS.map((check) => [check.file, check.indicators.join("\n")]));

test("quick profile verifies a bounded subset", () => {
  const inputs = fixture();
  const result = evaluate((file) => inputs.get(file), "quick");
  assert.equal(result.status, "pass");
  assert.equal(result.files, 4);
  assert(result.matched > 0);
  assert.equal(result.missing, 0);
});

test("standard profile covers every explicitly scoped source", () => {
  const inputs = fixture();
  const result = evaluate((file) => inputs.get(file), "standard");
  assert.equal(result.status, "pass");
  assert.equal(result.files, CHECKS.length);
});

test("missing control indicators cannot be silently passed", () => {
  const inputs = fixture();
  inputs.set("server/adminProxy/handlers.mjs", "");
  const result = evaluate((file) => inputs.get(file), "quick");
  assert.equal(result.status, "fail");
  assert(result.missing > 0);
});

test("missing source files fail closed", () => {
  const inputs = fixture();
  inputs.delete("cloudflare/public-api/src/auth/adminStepUp.ts");
  const result = evaluate((file) => {
    if (!inputs.has(file)) throw new Error("missing");
    return inputs.get(file);
  }, "standard");
  assert.equal(result.status, "fail");
});

test("rejects unsupported profiles", () => {
  assert.throws(() => evaluate(() => "", "deep"), TypeError);
});
