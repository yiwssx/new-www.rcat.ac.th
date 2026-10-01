const DEFAULT_CHUNK_BYTES = 6 * 256 * 1024;
const MAX_TRANSIENT_RETRIES = 3;
const MAX_SESSION_RESTARTS = 1;
const RETRY_DELAYS_MS = [250, 750, 1500];

function defaultDelay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function createUpstreamPayload(payload, bridgeToken) {
  const nextPayload = { ...payload };
  delete nextPayload.authToken;
  delete nextPayload.appsScriptBridgeToken;
  delete nextPayload.mediaBridgeToken;

  return {
    ...nextPayload,
    appsScriptBridgeToken: bridgeToken
  };
}

function readPayloadStatus(payload) {
  return payload && Number.isFinite(payload.statusCode) ? Number(payload.statusCode) : 200;
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function isExpiredPayload(payload) {
  const status = readPayloadStatus(payload);
  return payload?.code === "MEDIA_UPLOAD_SESSION_EXPIRED" || status === 410;
}

function isTransientPayload(payload) {
  const status = readPayloadStatus(payload);
  return payload?.code === "DRIVE_UPLOAD_TRANSIENT" || isRetryableStatus(status);
}

function isApplicationFailure(payload) {
  return Boolean(payload?.error) || readPayloadStatus(payload) >= 400;
}

function logTransientFailure(resource, result, attempt) {
  const details = {
    component: "apps-script-thumbnail-resumable",
    resource,
    attempt,
    failureClass: result.failureClass,
    upstreamStatus: result.httpStatus || undefined,
    bridgeStatus: result.payload ? readPayloadStatus(result.payload) : undefined
  };
  console.warn("Apps Script thumbnail bridge transient failure", details);
}

async function postAppsScriptResource({ appsScriptUrl, resource, payload, bridgeToken, fetchImpl }) {
  const url = new URL(appsScriptUrl);
  url.searchParams.set("resource", resource);
  const startedAt = Date.now();

  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(createUpstreamPayload(payload, bridgeToken)),
      cache: "no-store",
      redirect: "follow"
    });
  } catch {
    return {
      ok: false,
      failureClass: "network",
      httpStatus: 0,
      elapsedMs: Date.now() - startedAt,
      resource
    };
  }

  const text = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      failureClass: "upstream-http",
      httpStatus: response.status,
      elapsedMs: Date.now() - startedAt,
      resource
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      failureClass: "invalid-json",
      httpStatus: response.status,
      elapsedMs: Date.now() - startedAt,
      resource
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      failureClass: "invalid-json",
      httpStatus: response.status,
      elapsedMs: Date.now() - startedAt,
      resource
    };
  }

  return {
    ok: true,
    failureClass: null,
    httpStatus: response.status,
    elapsedMs: Date.now() - startedAt,
    resource,
    payload: parsed
  };
}

function createTransportFailure(result) {
  return {
    ok: false,
    responseStatus: 502,
    responsePayload: {
      error: "Apps Script bridge failed",
      diagnostic: "apps-script-thumbnail-resumable-v1",
      failureClass: result.failureClass || "unknown",
      ...(result.httpStatus ? { upstreamStatus: result.httpStatus } : {}),
      upstreamResource: result.resource
    }
  };
}

function createApplicationFailure(payload) {
  return {
    ok: false,
    responseStatus: 200,
    responsePayload: payload
  };
}

function validateProgressPayload(payload, totalBytes) {
  if (isApplicationFailure(payload)) {
    return null;
  }
  if (payload.uploadComplete === true) {
    return payload.asset && typeof payload.asset === "object" ? { uploadComplete: true, asset: payload.asset } : null;
  }
  if (payload.uploadComplete !== false || !Number.isSafeInteger(payload.nextByte)) {
    return null;
  }
  if (payload.nextByte < 0 || payload.nextByte > totalBytes) {
    return null;
  }
  return { uploadComplete: false, nextByte: payload.nextByte };
}

async function callWithTransientRetries(args, delayImpl) {
  let result;
  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt += 1) {
    result = await postAppsScriptResource(args);
    const transient = !result.ok
      ? result.failureClass === "network" ||
        result.failureClass === "invalid-json" ||
        isRetryableStatus(result.httpStatus)
      : isApplicationFailure(result.payload) && isTransientPayload(result.payload);

    if (!transient || attempt >= MAX_TRANSIENT_RETRIES) {
      return result;
    }

    logTransientFailure(args.resource, result, attempt + 1);
    await delayImpl(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
  }
  return result;
}

function interpretCallResult(result) {
  if (!result.ok) {
    return createTransportFailure(result);
  }
  if (isApplicationFailure(result.payload)) {
    return createApplicationFailure(result.payload);
  }
  return null;
}

export async function persistFacebookThumbnailViaResumableBridge({
  appsScriptUrl,
  bridgeToken,
  mediaPayload,
  fetchImpl,
  delayImpl = defaultDelay
}) {
  const bytes = Buffer.from(String(mediaPayload.fileBase64 || ""), "base64");
  if (!bytes.length) {
    return {
      ok: false,
      responseStatus: 422,
      responsePayload: { error: "Unable to create Facebook thumbnail" }
    };
  }

  const totalBytes = bytes.length;
  const uploadKey = String(mediaPayload.id || "").trim();
  const metadata = {
    id: mediaPayload.id,
    name: mediaPayload.name,
    type: "image",
    owner: mediaPayload.owner,
    fileName: mediaPayload.fileName,
    mimeType: mediaPayload.mimeType,
    size: mediaPayload.size || "",
    uploadKey,
    totalBytes
  };

  let uploadUrl = "";
  let currentByte = 0;
  let chunkSizeBytes = DEFAULT_CHUNK_BYTES;
  let sessionRestarts = 0;

  async function startSession() {
    const result = await callWithTransientRetries(
      {
        appsScriptUrl,
        resource: "media-upload-start",
        payload: metadata,
        bridgeToken,
        fetchImpl
      },
      delayImpl
    );
    const failure = interpretCallResult(result);
    if (failure) {
      return failure;
    }

    const progress = validateProgressPayload(result.payload, totalBytes);
    if (!progress) {
      return createTransportFailure({
        ok: false,
        failureClass: "invalid-contract",
        httpStatus: result.httpStatus,
        resource: "media-upload-start"
      });
    }
    if (progress.uploadComplete) {
      return { ok: true, asset: progress.asset };
    }

    if (
      typeof result.payload.uploadUrl !== "string" ||
      !result.payload.uploadUrl ||
      !Number.isSafeInteger(result.payload.chunkSizeBytes) ||
      result.payload.chunkSizeBytes <= 0
    ) {
      return createTransportFailure({
        ok: false,
        failureClass: "invalid-contract",
        httpStatus: result.httpStatus,
        resource: "media-upload-start"
      });
    }

    uploadUrl = result.payload.uploadUrl;
    currentByte = progress.nextByte;
    chunkSizeBytes = result.payload.chunkSizeBytes;
    return null;
  }

  async function queryStatus() {
    const result = await callWithTransientRetries(
      {
        appsScriptUrl,
        resource: "media-upload-status",
        payload: { ...metadata, uploadUrl },
        bridgeToken,
        fetchImpl
      },
      delayImpl
    );
    if (!result.ok) {
      return { failure: createTransportFailure(result) };
    }
    if (isApplicationFailure(result.payload)) {
      if (isExpiredPayload(result.payload)) {
        return { expired: true };
      }
      return { failure: createApplicationFailure(result.payload) };
    }
    const progress = validateProgressPayload(result.payload, totalBytes);
    if (!progress) {
      return {
        failure: createTransportFailure({
          ok: false,
          failureClass: "invalid-contract",
          httpStatus: result.httpStatus,
          resource: "media-upload-status"
        })
      };
    }
    return { progress };
  }

  async function restartSession() {
    if (sessionRestarts >= MAX_SESSION_RESTARTS) {
      return {
        ok: false,
        responseStatus: 502,
        responsePayload: {
          error: "Apps Script bridge failed",
          diagnostic: "apps-script-thumbnail-resumable-v1",
          failureClass: "session-restart-limit",
          upstreamResource: "media-upload-start"
        }
      };
    }
    sessionRestarts += 1;
    return startSession();
  }

  const initial = await startSession();
  if (initial) {
    return initial;
  }

  let retriesAtCurrentByte = 0;
  while (true) {
    if (currentByte >= totalBytes) {
      const status = await queryStatus();
      if (status.failure) {
        return status.failure;
      }
      if (status.expired) {
        const restarted = await restartSession();
        if (restarted) {
          return restarted;
        }
        retriesAtCurrentByte = 0;
        continue;
      }
      if (status.progress.uploadComplete) {
        return { ok: true, asset: status.progress.asset };
      }
      currentByte = status.progress.nextByte;
      continue;
    }

    const endByteExclusive = Math.min(totalBytes, currentByte + chunkSizeBytes);
    const result = await postAppsScriptResource({
      appsScriptUrl,
      resource: "media-upload-chunk",
      payload: {
        ...metadata,
        uploadUrl,
        chunkBase64: bytes.subarray(currentByte, endByteExclusive).toString("base64"),
        startByte: currentByte,
        endByte: endByteExclusive - 1
      },
      bridgeToken,
      fetchImpl
    });

    if (result.ok && !isApplicationFailure(result.payload)) {
      const progress = validateProgressPayload(result.payload, totalBytes);
      if (!progress) {
        return createTransportFailure({
          ok: false,
          failureClass: "invalid-contract",
          httpStatus: result.httpStatus,
          resource: "media-upload-chunk"
        });
      }
      if (progress.uploadComplete) {
        return { ok: true, asset: progress.asset };
      }
      currentByte = progress.nextByte;
      retriesAtCurrentByte = 0;
      continue;
    }

    if (result.ok && isApplicationFailure(result.payload) && isExpiredPayload(result.payload)) {
      const restarted = await restartSession();
      if (restarted) {
        return restarted;
      }
      retriesAtCurrentByte = 0;
      continue;
    }

    const transient = !result.ok
      ? result.failureClass === "network" ||
        result.failureClass === "invalid-json" ||
        isRetryableStatus(result.httpStatus)
      : isTransientPayload(result.payload);
    if (!transient) {
      return result.ok ? createApplicationFailure(result.payload) : createTransportFailure(result);
    }

    logTransientFailure("media-upload-chunk", result, retriesAtCurrentByte + 1);
    const status = await queryStatus();
    if (status.failure) {
      return status.failure;
    }
    if (status.expired) {
      const restarted = await restartSession();
      if (restarted) {
        return restarted;
      }
      retriesAtCurrentByte = 0;
      continue;
    }
    if (status.progress.uploadComplete) {
      return { ok: true, asset: status.progress.asset };
    }

    if (status.progress.nextByte === currentByte) {
      if (retriesAtCurrentByte >= MAX_TRANSIENT_RETRIES) {
        return result.ok ? createApplicationFailure(result.payload) : createTransportFailure(result);
      }
      retriesAtCurrentByte += 1;
      await delayImpl(RETRY_DELAYS_MS[Math.min(retriesAtCurrentByte - 1, RETRY_DELAYS_MS.length - 1)]);
    } else {
      retriesAtCurrentByte = 0;
    }
    currentByte = status.progress.nextByte;
  }
}
