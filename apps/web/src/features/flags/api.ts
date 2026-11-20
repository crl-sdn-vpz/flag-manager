import { useQuery } from "@tanstack/react-query";
import { listFlagsOptions } from "api-client/query";

export function useFlags() {
  return useQuery(listFlagsOptions());
}
