import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsAuthError } from "./errors";
import {
  CmsStepUpCancelledError,
  cmsStepUpCoordinator,
  isReplayableRequestBody,
  runCmsOperationWithStepUp
} from "./stepUpCoordinator";

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

  it("fails every waiter explicitly and closes the shared dialog", async () => {
    const failure = new CmsAuthError(503);
    const first = cmsStepUpCoordinator.request("password");
    const second = cmsStepUpCoordinator.request("password");

    cmsStepUpCoordinator.fail(failure);

    await expect(first).rejects.toBe(failure);
    await expect(second).rejects.toBe(failure);
    expect(cmsStepUpCoordinator.getSnapshot()).toEqual({ open: false, assurance: "password" });
  });

  it("retries a direct CMS operation once after the exact requested assurance", async () => {
    const operation = vi.fn().mockRejectedValueOnce(new CmsAuthError(428)).mockResolvedValueOnce("complete");
    const request = runCmsOperationWithStepUp("mfa", operation);

    await vi.waitFor(() => expect(cmsStepUpCoordinator.getSnapshot()).toEqual({ open: true, assurance: "mfa" }));
    cmsStepUpCoordinator.complete();

    await expect(request).resolves.toBe("complete");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("returns a repeated 428 and does not retry after cancellation or other errors", async () => {
    const repeated = vi.fn().mockRejectedValue(new CmsAuthError(428));
    const repeatedRequest = runCmsOperationWithStepUp("password", repeated);
    await vi.waitFor(() => expect(cmsStepUpCoordinator.getSnapshot().open).toBe(true));
    cmsStepUpCoordinator.complete();
    await expect(repeatedRequest).rejects.toMatchObject({ status: 428 });
    expect(repeated).toHaveBeenCalledTimes(2);

    const cancelled = vi.fn().mockRejectedValue(new CmsAuthError(428));
    const cancelledRequest = runCmsOperationWithStepUp("mfa", cancelled);
    await vi.waitFor(() => expect(cmsStepUpCoordinator.getSnapshot().open).toBe(true));
    cmsStepUpCoordinator.cancel();
    await expect(cancelledRequest).rejects.toBeInstanceOf(CmsStepUpCancelledError);
    expect(cancelled).toHaveBeenCalledTimes(1);

    const forbidden = vi.fn().mockRejectedValue(new CmsAuthError(403));
    await expect(runCmsOperationWithStepUp("password", forbidden)).rejects.toMatchObject({ status: 403 });
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  it("allows only replayable request bodies", () => {
    expect(isReplayableRequestBody(undefined)).toBe(true);
    expect(isReplayableRequestBody('{"safe":true}')).toBe(true);
    expect(isReplayableRequestBody(new Blob(["safe"]))).toBe(true);
    expect(isReplayableRequestBody(new ArrayBuffer(4))).toBe(true);
    expect(isReplayableRequestBody(new ReadableStream())).toBe(false);
  });
});
