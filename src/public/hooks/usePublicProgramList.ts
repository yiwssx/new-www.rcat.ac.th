import { useQuery } from "@tanstack/react-query";
import { publicProgramListQueryOptions } from "../../features/public-programs";

export function usePublicProgramList() {
  return useQuery(publicProgramListQueryOptions({ consumeAbortSignal: false }));
}
