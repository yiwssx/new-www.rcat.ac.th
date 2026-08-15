import { describe, expect, it } from "vitest";
import { resolveD1DrillEnvironmentDeployment } from "./resolve-d1-drill-environment-deployment.mjs";

const run = {
  created_at: "2026-08-15T10:15:12Z",
  run_started_at: "2026-08-15T10:15:12Z"
};

function deployment(overrides = {}) {
  return {
    id: 12345,
    environment: "production",
    ref: "master",
    sha: "abc123",
    creator: { login: "yiwssx" },
    performed_via_github_app: { slug: "github-actions" },
    production_environment: false,
    created_at: "2026-08-15T10:15:15Z",
    ...overrides
  };
}

function resolve(deployments) {
  return resolveD1DrillEnvironmentDeployment({
    run,
    deployments,
    sha: "abc123",
    actor: "yiwssx"
  });
}

describe("resolveD1DrillEnvironmentDeployment", () => {
  it("resolves exactly one GitHub Actions credential-gate deployment", () => {
    expect(resolve([deployment()])).toBe("12345");
  });

  it("accepts GitHub's canonical Environment name casing", () => {
    expect(resolve([deployment({ environment: "Production" })])).toBe("12345");
  });

  it("ignores Vercel and real production deployments", () => {
    expect(
      resolve([
        deployment({ id: 1, creator: { login: "vercel[bot]" }, performed_via_github_app: null }),
        deployment({ id: 2, production_environment: true }),
        deployment({ id: 3 })
      ])
    ).toBe("3");
  });

  it("ignores deployments for another SHA, branch, actor, or app", () => {
    expect(
      resolve([
        deployment({ id: 1, sha: "other" }),
        deployment({ id: 2, ref: "feature" }),
        deployment({ id: 3, creator: { login: "someone-else" } }),
        deployment({ id: 4, performed_via_github_app: { slug: "other-app" } }),
        deployment({ id: 5 })
      ])
    ).toBe("5");
  });

  it("rejects deployments outside the run time window", () => {
    expect(() => resolve([deployment({ created_at: "2026-08-15T10:16:00Z" })])).toThrow(
      "expected exactly one D1 drill environment deployment for this run, found 0"
    );
  });

  it("fails closed when no deployment matches", () => {
    expect(() => resolve([])).toThrow("expected exactly one D1 drill environment deployment for this run, found 0");
  });

  it("fails closed when matching is ambiguous", () => {
    expect(() => resolve([deployment({ id: 1 }), deployment({ id: 2 })])).toThrow(
      "expected exactly one D1 drill environment deployment for this run, found 2"
    );
  });

  it("rejects invalid workflow timestamps", () => {
    expect(() =>
      resolveD1DrillEnvironmentDeployment({
        run: { run_started_at: "not-a-date" },
        deployments: [deployment()],
        sha: "abc123",
        actor: "yiwssx"
      })
    ).toThrow("invalid workflow run timestamp");
  });
});
