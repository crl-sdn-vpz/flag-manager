import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // networkMode "always": while the browser reports offline, requests fail fast (showing
      // the error and rolling back) instead of pausing and silently sending a flag change
      // minutes later when the connection returns.
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
        networkMode: "always",
      },
      mutations: { networkMode: "always" },
    },
  });
}
