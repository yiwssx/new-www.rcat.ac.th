import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { isValidRequestId, RCAT_REQUEST_ID_HEADER } from "../src/requestId";

const PRIVATE_ERROR_SENTINEL = "private-failure-detail-must-not-escape";
const PRIVATE_STACK_SENTINEL = "sensitive/internal/path/worker-stack.js";

vi.mock("../src/router", () => ({
  routeRequest: vi.fn(async () => {
    const error = new Error(PRIVATE_ERROR_SENTINEL);
    error.stack = `Error: ${PRIVATE_ERROR_SENTINEL}\\n at ${PRIVATE_STACK_SENTINEL}`;
    throw error;
  })
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Worker unhandled-error disclosure boundary (CodeQL S04)", () => {
  it("returns a fixed 500 response and logs no exception message or stack", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await worker.fetch(new Request("https://public-api.example.invalid/health"), {});
    const body = await response.text();
    const log = errorSpy.mock.calls.map((entry) => entry.join(" ")).join("\n");

    expect(response.status).toBe(500);
    expect(JSON.parse(body)).toEqual({ error: "internal server error" });
    expect(body).not.toContain(PRIVATE_ERROR_SENTINEL);
    expect(body).not.toContain(PRIVATE_STACK_SENTINEL);
    expect(log).not.toContain(PRIVATE_ERROR_SENTINEL);
    expect(log).not.toContain(PRIVATE_STACK_SENTINEL);
    expect(log).toContain("worker_unhandled_error");
    expect(isValidRequestId(response.headers.get(RCAT_REQUEST_ID_HEADER))).toBe(true);
  });
});
