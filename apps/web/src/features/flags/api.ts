import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Flag, FlagList } from "api-client";
import { listFlagsOptions, listFlagsQueryKey, setFlagEnabledMutation } from "api-client/query";

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
