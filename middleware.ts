import { getEnv, next } from "@vercel/functions";
import { evaluateP6bEdgeWaf, P6B_EDGE_WAF_MARKER } from "./server/security/edgeWafPolicy.js";

const CANONICAL_PRODUCTION_HOST = "www.rcat.ac.th";
const VERCEL_DEPLOYMENT_HOST_SUFFIX = ".vercel.app";
// An explicit routing hint, NOT an authentication credential. Vercel's normal
// Admin/CMS auth and Edge WAF continue to apply after canonical routing.
// Other *.vercel.app hosts must keep their 308 canonical redirects.
const RCAT_GATEWAY_ORIGIN_HOST = "new-wwwrcatacth-rcat-it-dev-team.vercel.app";
const RCAT_GATEWAY_ORIGIN_HEADER_VALUE = "rcat-origin-v1";

export const config = {
  matcher: "/:path*",
  runtime: "nodejs"
};

export function getCanonicalProductionRedirect(
  requestUrl: string,
  vercelEnvironment: string | undefined,
  originBridgeHeader?: string | null
): URL | null {
  if (vercelEnvironment !== "production") {
    return null;
  }

  const url = new URL(requestUrl);
  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith(VERCEL_DEPLOYMENT_HOST_SUFFIX)) {
    return null;
  }

  // The Cloudflare SaaS gateway MUST reach the real Vercel deployment rather
  // than receiving the 308 back to www.rcat.ac.th (which would create a loop).
  // Permit only the known project-level alias with the explicit bridge marker.
  // This bypasses URL canonicalization only: it does not grant access to APIs.
  if (
    url.protocol === "https:" &&
    hostname === RCAT_GATEWAY_ORIGIN_HOST &&
    originBridgeHeader === RCAT_GATEWAY_ORIGIN_HEADER_VALUE
  ) {
    return null;
  }

  url.protocol = "https:";
  url.hostname = CANONICAL_PRODUCTION_HOST;
  url.port = "";

  return url;
}

function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export default function middleware(request: Request) {
  const redirectUrl = getCanonicalProductionRedirect(
    request.url,
    getEnv().VERCEL_ENV,
    request.headers.get("X-RCAT-Origin-Bridge")
  );

  if (redirectUrl) {
    return Response.redirect(redirectUrl, 308);
  }

  const url = new URL(request.url);
  if (!isApiPath(url.pathname)) {
    return next();
  }

  const decision = evaluateP6bEdgeWaf(request);

  if (decision.action === "deny") {
    return Response.json(
      { error: "request denied by edge security policy" },
      {
        status: decision.status,
        headers: {
          "Cache-Control": "no-store",
          "X-RCAT-Edge-WAF": P6B_EDGE_WAF_MARKER
        }
      }
    );
  }

  return next({
    headers: {
      "X-RCAT-Edge-WAF": P6B_EDGE_WAF_MARKER
    }
  });
}
