export type PublicReadResource =
  "public-document-list" | "public-home" | "content-list" | "content-detail" | "search" | "program" | "visitor-stats";

export interface PublicReadRouteContract {
  resource: PublicReadResource;
  method: "GET";
  pathPattern: string;
  phase: "M17-B";
  responseType:
    | "PublicDocumentListSnapshot"
    | "PublicHomeSnapshot"
    | "PublicContentListSnapshot"
    | "PublicContentDetailSnapshot"
    | "PublicSearchSnapshot"
    | "PublicProgramListSnapshot"
    | "PublicVisitorStatsSnapshot";
  implemented: boolean;
}
