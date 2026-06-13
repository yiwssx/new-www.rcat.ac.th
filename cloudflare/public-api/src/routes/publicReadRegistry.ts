import type { PublicReadRouteContract } from "../contracts/publicRead";

export const PUBLIC_READ_ROUTE_REGISTRY = [
  {
    resource: "public-document-list",
    method: "GET",
    pathPattern: "/api/public/documents",
    phase: "M17-B",
    responseType: "PublicDocumentListSnapshot",
    implemented: true
  },
  {
    resource: "public-home",
    method: "GET",
    pathPattern: "/api/public/home",
    phase: "M17-B",
    responseType: "PublicHomeSnapshot",
    implemented: true
  },
  {
    resource: "content-list",
    method: "GET",
    pathPattern: "/api/public/content",
    phase: "M17-B",
    responseType: "PublicContentListSnapshot",
    implemented: true
  },
  {
    resource: "content-detail",
    method: "GET",
    pathPattern: "/api/public/content/:slug",
    phase: "M17-B",
    responseType: "PublicContentDetailSnapshot",
    implemented: true
  },
  {
    resource: "search",
    method: "GET",
    pathPattern: "/api/public/search",
    phase: "M17-B",
    responseType: "PublicSearchSnapshot",
    implemented: true
  },
  {
    resource: "program",
    method: "GET",
    pathPattern: "/api/public/programs",
    phase: "M17-B",
    responseType: "PublicProgramListSnapshot",
    implemented: true
  },
  {
    resource: "visitor-stats",
    method: "GET",
    pathPattern: "/api/public/visitor-stats",
    phase: "M17-B",
    responseType: "PublicVisitorStatsSnapshot",
    implemented: true
  }
] as const satisfies readonly PublicReadRouteContract[];
