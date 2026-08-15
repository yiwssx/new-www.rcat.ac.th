import { getNodeRequestId, RCAT_REQUEST_ID_HEADER } from "../observability/requestId.mjs";

export function createCmsCorrelatedFetch(request, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    return fetchImpl;
  }

  const requestId = getNodeRequestId(request);

  return async (input, init = {}) => {
    const headers = new Headers(init.headers);

    if (requestId) {
      headers.set(RCAT_REQUEST_ID_HEADER, requestId);
    }

    return fetchImpl(input, {
      ...init,
      headers
    });
  };
}
