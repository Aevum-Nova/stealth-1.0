import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as triggersApi from "@/api/triggers";
import { authQueryKey, useAuthQueryKey, useAuthQueryScope } from "@/hooks/use-auth-query";
import type { TriggerPayload, TriggerUpdatePayload } from "@/types/trigger";

export function useTriggerConfig() {
  const queryKey = useAuthQueryKey("triggers", "config");

  return useQuery({
    queryKey,
    queryFn: () => triggersApi.getTriggerConfig(),
  });
}

export function useTriggers() {
  const queryKey = useAuthQueryKey("triggers");

  return useQuery({
    queryKey,
    queryFn: () => triggersApi.listTriggers(),
  });
}

export function useTrigger(id?: string) {
  const queryKey = useAuthQueryKey("triggers", id);

  return useQuery({
    queryKey,
    queryFn: () => triggersApi.getTrigger(id as string),
    enabled: Boolean(id),
  });
}

export function useTriggerMutations() {
  const scope = useAuthQueryScope();
  const queryClient = useQueryClient();

  const invalidate = async (id?: string) => {
    await queryClient.invalidateQueries({ queryKey: authQueryKey(scope, "triggers") });
    await queryClient.invalidateQueries({ queryKey: authQueryKey(scope, "triggers", "config") });
    if (id) {
      await queryClient.invalidateQueries({ queryKey: authQueryKey(scope, "triggers", id) });
    }
  };

  return {
    createTrigger: useMutation({
      mutationFn: (payload: TriggerPayload) => triggersApi.createTrigger(payload),
      onSuccess: async (data) => invalidate(data.data.id),
    }),
    updateTrigger: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: TriggerUpdatePayload }) => triggersApi.updateTrigger(id, payload),
      onSuccess: async (data) => invalidate(data.data.id),
    }),
    deleteTrigger: useMutation({
      mutationFn: (id: string) => triggersApi.deleteTrigger(id),
      onSuccess: async () => invalidate(),
    }),
    pauseTrigger: useMutation({
      mutationFn: (id: string) => triggersApi.pauseTrigger(id),
      onSuccess: async (data) => invalidate(data.data.id),
    }),
    resumeTrigger: useMutation({
      mutationFn: (id: string) => triggersApi.resumeTrigger(id),
      onSuccess: async (data) => invalidate(data.data.id),
    }),
  };
}
