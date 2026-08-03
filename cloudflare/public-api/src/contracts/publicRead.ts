export type PublicReadResource =
  | "public-document-list"
  | "public-home"
  | "public-shell"
  | "content-list"
  | "content-detail"
  | "search"
  | "program"
  | "visitor-stats";

export interface PublicReadRouteContract {
  resource: PublicReadResource;
  method: "GET";
  pathPattern: string;
  phase: "M17-B" | "SSR-readiness";
  responseType:
    | "PublicDocumentListSnapshot"
    | "PublicHomeSnapshot"
    | "PublicShellSnapshot"
    | "PublicContentListSnapshot"
    | "PublicContentDetailSnapshot"
    | "PublicSearchSnapshot"
    | "PublicProgramListSnapshot"
    | "PublicVisitorStatsSnapshot";
  implemented: boolean;
}
