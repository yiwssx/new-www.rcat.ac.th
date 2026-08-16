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

export default async function cmsAuth(request, response) {
  const queryShape = getRequestQueryShape(request?.query);

  console.error(
    JSON.stringify({
      level: "warning",
      event: "cms-auth-runtime-request-shape-v1",
      method: String(request?.method || "UNKNOWN").toUpperCase(),
      pathname: getSafeRequestPathname(request?.url),
      urlQueryKeys: getUrlQueryKeys(request?.url),
      requestQueryKeys: queryShape.keys,
      requestQueryRouteMarkerType: queryShape.routeMarkerType
    })
  );

  await handleCmsAuthDispatch(request, response);
}
