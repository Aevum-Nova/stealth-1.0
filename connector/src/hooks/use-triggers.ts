import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as triggersApi from "@/api/triggers";
import type { TriggerPayload, TriggerUpdatePayload } from "@/types/trigger";

export function useTriggerConfig() {
  return useQuery({
    queryKey: ["triggers", "config"],
    queryFn: () => triggersApi.getTriggerConfig(),
  });
}

export function useTriggers() {
  return useQuery({
    queryKey: ["triggers"],
    queryFn: () => triggersApi.listTriggers(),
  });
}

export function useTrigger(id?: string) {
  return useQuery({
    queryKey: ["triggers", id],
    queryFn: () => triggersApi.getTrigger(id as string),
    enabled: Boolean(id),
  });
}

export function useTriggerMutations() {
  const queryClient = useQueryClient();

  const invalidate = async (id?: string) => {
    await queryClient.invalidateQueries({ queryKey: ["triggers"] });
    await queryClient.invalidateQueries({ queryKey: ["triggers", "config"] });
    if (id) {
      await queryClient.invalidateQueries({ queryKey: ["triggers", id] });
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
