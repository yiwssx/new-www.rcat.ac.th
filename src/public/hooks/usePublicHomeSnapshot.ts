import { useQuery } from "@tanstack/react-query";
import { publicHomeQueryOptions } from "../../features/public-home";

export function usePublicHomeSnapshot() {
  return useQuery(publicHomeQueryOptions({ consumeAbortSignal: false }));
}
