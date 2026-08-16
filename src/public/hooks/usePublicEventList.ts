import { useQuery } from "@tanstack/react-query";
import { publicEventListQueryOptions } from "../../features/public-events";

export function usePublicEventList() {
  return useQuery(publicEventListQueryOptions({ consumeAbortSignal: false }));
}
