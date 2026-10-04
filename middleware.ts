import { getEnv, next } from "@vercel/functions";
import { evaluateP6bEdgeWaf, P6B_EDGE_WAF_MARKER } from "./server/security/edgeWafPolicy.js";

const CANONICAL_PRODUCTION_HOST = "www.rcat.ac.th";
const VERCEL_DEPLOYMENT_HOST_SUFFIX = ".vercel.app";

export const config = {
  matcher: "/:path*",
  runtime: "nodejs"
};

export function getCanonicalProductionRedirect(
  requestUrl: string,
  vercelEnvironment: string | undefined
): URL | null {
  if (vercelEnvironment !== "production") {
    return null;
  }

  const url = new URL(requestUrl);
  if (!url.hostname.toLowerCase().endsWith(VERCEL_DEPLOYMENT_HOST_SUFFIX)) {
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
  const redirectUrl = getCanonicalProductionRedirect(request.url, getEnv().VERCEL_ENV);

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
