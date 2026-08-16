import { handleCmsAuthDispatch } from "../server/cmsAuth/dispatcher.mjs";
import { getSafeRequestPathname } from "../server/observability/requestId.mjs";

const ROUTE_PARAMETER = "_rcatCmsRoute";

function getUrlQueryKeys(value) {
  try {
    return [...new Set(new URL(value || "/", "https://cms-auth-diagnostic.invalid").searchParams.keys())].sort();
  } catch {
    return [];
  }
}

function getRequestQueryShape(query) {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    return {
      keys: [],
      routeMarkerType: query === undefined ? "undefined" : typeof query
    };
  }

  return {
    keys: Object.keys(query).sort(),
    routeMarkerType: typeof query[ROUTE_PARAMETER]
  };
}

function getOwnKeys(value) {
  return value && typeof value === "object" ? Object.keys(value).sort() : [];
}

export default async function cmsAuth(request, response) {
  const queryShape = getRequestQueryShape(request?.query);

  console.error(
    JSON.stringify({
      level: "warning",
      event: "cms-auth-runtime-request-shape-v2",
      method: String(request?.method || "UNKNOWN").toUpperCase(),
      pathname: getSafeRequestPathname(request?.url),
      originalUrlPathname: getSafeRequestPathname(request?.originalUrl),
      pathPathname: getSafeRequestPathname(request?.path),
      urlQueryKeys: getUrlQueryKeys(request?.url),
      requestQueryKeys: queryShape.keys,
      requestQueryRouteMarkerType: queryShape.routeMarkerType,
      requestOwnKeys: getOwnKeys(request),
      requestHeaderKeys: getOwnKeys(request?.headers)
    })
  );

  await handleCmsAuthDispatch(request, response);
}
