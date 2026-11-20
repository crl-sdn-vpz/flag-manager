import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ErrorResponse, Flag, FlagList } from "api-client";
import {
  createFlagMutation,
  listFlagsOptions,
  listFlagsQueryKey,
  setFlagEnabledMutation,
} from "api-client/query";

export function useFlags() {
  return useQuery(listFlagsOptions());
}

/**
 * Optimistic toggle. Only the toggled flag is patched in the cache (no list snapshot),
 * so concurrent toggles of different flags cannot overwrite each other on rollback.
 */
export function useSetFlagEnabled() {
  const queryClient = useQueryClient();
  const queryKey = listFlagsQueryKey();

  const patchFlag = (key: string, patch: (flag: Flag) => Flag) =>
    queryClient.setQueryData<FlagList>(queryKey, (list) =>
      list ? { items: list.items.map((flag) => (flag.key === key ? patch(flag) : flag)) } : list,
    );

  return useMutation({
    ...setFlagEnabledMutation(),
    onMutate: async ({ path, body }) => {
      await queryClient.cancelQueries({ queryKey });
      patchFlag(path.key, (flag) => ({ ...flag, enabled: body.enabled }));
    },
    onError: (_error, { path, body }) => {
      patchFlag(path.key, (flag) => ({ ...flag, enabled: !body.enabled }));
    },
    onSuccess: (saved) => {
      patchFlag(saved.key, () => saved);
    },
  });
}

/** The API's error body; network failures throw a TypeError instead. */
export function isErrorResponse(error: unknown): error is ErrorResponse {
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

/** Adds the created flag to the cached list in key order, so no refetch is needed. */
export function useCreateFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    ...createFlagMutation(),
    onSuccess: (created) => {
      queryClient.setQueryData<FlagList>(listFlagsQueryKey(), (list) =>
        list
          ? { items: [...list.items, created].sort((a, b) => a.key.localeCompare(b.key)) }
          : list,
      );
    },
  });
}
