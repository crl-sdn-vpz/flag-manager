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
const SET_FLAG_ENABLED_KEY = ["setFlagEnabled"];

export function useSetFlagEnabled() {
  const queryClient = useQueryClient();
  const queryKey = listFlagsQueryKey();

  const patchFlag = (key: string, patch: (flag: Flag) => Flag) =>
    queryClient.setQueryData<FlagList>(queryKey, (list) =>
      list ? { items: list.items.map((flag) => (flag.key === key ? patch(flag) : flag)) } : list,
    );

  return useMutation({
    ...setFlagEnabledMutation(),
    mutationKey: SET_FLAG_ENABLED_KEY,
    onMutate: async ({ path, body }) => {
      await queryClient.cancelQueries({ queryKey });
      patchFlag(path.key, (flag) => ({ ...flag, enabled: body.enabled }));
    },
    onError: async (_error, { path, body }) => {
      patchFlag(path.key, (flag) => ({ ...flag, enabled: !body.enabled }));
      // The rollback is a guess: the change may have reached the server even though the
      // response failed. Re-read the list, but only when no other toggle is in flight, so a
      // refetch cannot overwrite another flag's optimistic state.
      if (queryClient.isMutating({ mutationKey: SET_FLAG_ENABLED_KEY }) === 1) {
        await queryClient.invalidateQueries({ queryKey });
      }
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
    onSuccess: async (created) => {
      // A list fetch already in flight would land after this write and drop the new flag.
      await queryClient.cancelQueries({ queryKey: listFlagsQueryKey() });
      queryClient.setQueryData<FlagList>(listFlagsQueryKey(), (list) =>
        list
          ? { items: [...list.items, created].sort((a, b) => a.key.localeCompare(b.key)) }
          : list,
      );
    },
  });
}
