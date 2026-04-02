import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as featureRequestsApi from "@/api/feature-requests";
import { authQueryKey, useAuthQueryKey, useAuthQueryScope } from "@/hooks/use-auth-query";
import type { FeatureRequestFilters, FeatureRequestPatch } from "@/types/feature-request";

export function useFeatureRequests(filters: FeatureRequestFilters = {}) {
  const queryKey = useAuthQueryKey("feature-requests", filters);

  return useQuery({
    queryKey,
    queryFn: () => featureRequestsApi.listFeatureRequests(filters),
    placeholderData: (previousData) => previousData,
  });
}

export function useFeatureRequest(id?: string) {
  const queryKey = useAuthQueryKey("feature-request", id);

  return useQuery({
    queryKey,
    queryFn: () => featureRequestsApi.getFeatureRequest(id as string),
    enabled: Boolean(id)
  });
}

export function useFeatureRequestSignals(id?: string) {
  const queryKey = useAuthQueryKey("feature-request", id, "signals");

  return useQuery({
    queryKey,
    queryFn: () => featureRequestsApi.getFeatureRequestSignals(id as string),
    enabled: Boolean(id)
  });
}

export function useFeatureRequestImages(id?: string) {
  const queryKey = useAuthQueryKey("feature-request", id, "images");

  return useQuery({
    queryKey,
    queryFn: () => featureRequestsApi.getFeatureRequestImages(id as string),
    enabled: Boolean(id)
  });
}

export function usePatchFeatureRequest(id: string) {
  const scope = useAuthQueryScope();
  const queryClient = useQueryClient();
  const featureRequestKey = authQueryKey(scope, "feature-request", id);
  const featureRequestsKey = authQueryKey(scope, "feature-requests");

  return useMutation({
    mutationFn: (payload: FeatureRequestPatch) => featureRequestsApi.patchFeatureRequest(id, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: featureRequestKey });
      const previous = queryClient.getQueryData(featureRequestKey);

      queryClient.setQueryData(featureRequestKey, (old: any) => {
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
        queryClient.setQueryData(featureRequestKey, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: featureRequestKey });
      await queryClient.invalidateQueries({ queryKey: featureRequestsKey });
    }
  });
}

export function useFeatureRequestActions() {
  const scope = useAuthQueryScope();
  const queryClient = useQueryClient();
  const featureRequestsKey = authQueryKey(scope, "feature-requests");

  return {
    merge: useMutation({
      mutationFn: ({ id, targetId }: { id: string; targetId: string }) =>
        featureRequestsApi.mergeFeatureRequest(id, targetId),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: featureRequestsKey });
      }
    }),
    sendToAgent: useMutation({
      mutationFn: (id: string) => featureRequestsApi.sendToAgent(id),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: featureRequestsKey });
      }
    }),
    delete: useMutation({
      mutationFn: (id: string) => featureRequestsApi.deleteFeatureRequest(id),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: featureRequestsKey });
      }
    }),
    deleteMany: useMutation({
      mutationFn: async (ids: string[]) => {
        const results = await Promise.allSettled(ids.map((id) => featureRequestsApi.deleteFeatureRequest(id)));
        const failures = results.filter((result) => result.status === "rejected");
        if (failures.length) {
          throw new Error(`Failed to delete ${failures.length} feature request(s).`);
        }
        return results;
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: featureRequestsKey });
      }
    })
  };
}
