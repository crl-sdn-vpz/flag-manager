import { useQuery } from "@tanstack/react-query";
import { getHealthOptions } from "api-client/query";

export function useHealth() {
  return useQuery(getHealthOptions());
}
