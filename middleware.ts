import { next } from "@vercel/functions";
import { evaluateP6bEdgeWaf, P6B_EDGE_WAF_MARKER } from "./server/security/edgeWafPolicy.mjs";

export const config = {
  matcher: "/api/:path*"
};

export default function middleware(request: Request) {
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
