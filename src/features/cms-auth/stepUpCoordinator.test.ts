import { afterEach, describe, expect, it } from "vitest";
import { CmsStepUpCancelledError, cmsStepUpCoordinator, isReplayableRequestBody } from "./stepUpCoordinator";

describe("CMS step-up coordinator", () => {
  afterEach(() => {
    cmsStepUpCoordinator.resetForTests();
  });

  it("deduplicates concurrent 428 requests into one active dialog and shared completion", async () => {
    const first = cmsStepUpCoordinator.request("password");
    const second = cmsStepUpCoordinator.request("password");

    expect(cmsStepUpCoordinator.getSnapshot()).toEqual({ open: true, assurance: "password" });
    cmsStepUpCoordinator.complete();

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
  });

  it("upgrades a shared dialog to MFA assurance", async () => {
    const first = cmsStepUpCoordinator.request("password");
    const second = cmsStepUpCoordinator.request("mfa");

    expect(cmsStepUpCoordinator.getSnapshot()).toEqual({ open: true, assurance: "mfa" });
    cmsStepUpCoordinator.complete();
    await Promise.all([first, second]);
  });

  it("rejects every waiter with a typed cancellation error", async () => {
    const request = cmsStepUpCoordinator.request("password");
    cmsStepUpCoordinator.cancel();
    await expect(request).rejects.toBeInstanceOf(CmsStepUpCancelledError);
  });

  it("allows only replayable request bodies", () => {
    expect(isReplayableRequestBody(undefined)).toBe(true);
    expect(isReplayableRequestBody('{"safe":true}')).toBe(true);
    expect(isReplayableRequestBody(new Blob(["safe"]))).toBe(true);
    expect(isReplayableRequestBody(new ArrayBuffer(4))).toBe(true);
    expect(isReplayableRequestBody(new ReadableStream())).toBe(false);
  });
});
