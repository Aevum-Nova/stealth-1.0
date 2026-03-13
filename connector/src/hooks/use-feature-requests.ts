import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as featureRequestsApi from "@/api/feature-requests";
import type { FeatureRequestFilters, FeatureRequestPatch } from "@/types/feature-request";

export function useFeatureRequests(filters: FeatureRequestFilters = {}) {
  return useQuery({
    queryKey: ["feature-requests", filters],
    queryFn: () => featureRequestsApi.listFeatureRequests(filters)
  });
}

export function useFeatureRequest(id?: string) {
  return useQuery({
    queryKey: ["feature-request", id],
    queryFn: () => featureRequestsApi.getFeatureRequest(id as string),
    enabled: Boolean(id)
  });
}

export function useFeatureRequestSignals(id?: string) {
  return useQuery({
    queryKey: ["feature-request", id, "signals"],
    queryFn: () => featureRequestsApi.getFeatureRequestSignals(id as string),
    enabled: Boolean(id)
  });
}

export function useFeatureRequestImages(id?: string) {
  return useQuery({
    queryKey: ["feature-request", id, "images"],
    queryFn: () => featureRequestsApi.getFeatureRequestImages(id as string),
    enabled: Boolean(id)
  });
}

export function usePatchFeatureRequest(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: FeatureRequestPatch) => featureRequestsApi.patchFeatureRequest(id, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["feature-request", id] });
      const previous = queryClient.getQueryData(["feature-request", id]);

      queryClient.setQueryData(["feature-request", id], (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            ...payload,
            human_edited: true,
            human_edited_fields: [...new Set([...(old.data.human_edited_fields ?? []), ...Object.keys(payload)])]
          }
        };
      });

      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["feature-request", id], context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["feature-request", id] });
      await queryClient.invalidateQueries({ queryKey: ["feature-requests"] });
    }
  });
}

export function useFeatureRequestActions() {
  const queryClient = useQueryClient();

  return {
    approve: useMutation({
      mutationFn: (id: string) => featureRequestsApi.approveFeatureRequest(id),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["feature-requests"] });
      }
    }),
    reject: useMutation({
      mutationFn: (id: string) => featureRequestsApi.rejectFeatureRequest(id),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["feature-requests"] });
      }
    }),
    merge: useMutation({
      mutationFn: ({ id, targetId }: { id: string; targetId: string }) =>
        featureRequestsApi.mergeFeatureRequest(id, targetId),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["feature-requests"] });
      }
    }),
    sendToAgent: useMutation({
      mutationFn: (id: string) => featureRequestsApi.sendToAgent(id),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["feature-requests"] });
      }
    }),
    delete: useMutation({
      mutationFn: (id: string) => featureRequestsApi.deleteFeatureRequest(id),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["feature-requests"] });
      }
    })
  };
}
