import { useQuery } from "@tanstack/react-query";
import { publicDocumentListQueryOptions } from "../../features/public-documents";

export function usePublicDocumentList() {
  return useQuery(publicDocumentListQueryOptions({ consumeAbortSignal: false }));
}
