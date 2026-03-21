import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as agentApi from "@/api/agent";
import type { AgentJob, ProposedChange } from "@/types/agent";

export function useFeatureRequestSummary(featureRequestId?: string, existingSummary?: string | null) {
  return useQuery({
    queryKey: ["fr-summary", featureRequestId],
    queryFn: () => agentApi.generateSummary(featureRequestId as string),
    enabled: Boolean(featureRequestId) && !existingSummary,
    staleTime: Infinity,
  });
}

export function useChatHistory(featureRequestId?: string) {
  return useQuery({
    queryKey: ["agent-chat", featureRequestId],
    queryFn: () => agentApi.getChatHistory(featureRequestId as string),
    enabled: Boolean(featureRequestId),
  });
}

export function useSendChatMessage(featureRequestId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: string) =>
      agentApi.sendChatMessage(featureRequestId, message),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["agent-chat", featureRequestId],
      });
    },
  });
}

export function useAgentJobs(featureRequestId?: string) {
  return useQuery({
    queryKey: ["agent-jobs", featureRequestId],
    queryFn: () => agentApi.listJobs(featureRequestId as string),
    enabled: Boolean(featureRequestId),
    refetchInterval: (query) => {
      const jobs = query.state.data?.data;
      if (!jobs) return false;
      const hasActive = jobs.some(
        (j: AgentJob) => j.status === "pending" || j.status === "running",
      );
      return hasActive ? 3000 : false;
    },
  });
}

export function usePrStatus(featureRequestId?: string) {
  return useQuery({
    queryKey: ["pr-status", featureRequestId],
    queryFn: () => agentApi.getPrStatus(featureRequestId as string),
    enabled: Boolean(featureRequestId),
    staleTime: 30_000,
  });
}

export function usePrFiles(featureRequestId?: string, hasPr?: boolean) {
  return useQuery({
    queryKey: ["pr-files", featureRequestId],
    queryFn: () => agentApi.getPrFiles(featureRequestId as string),
    enabled: Boolean(featureRequestId) && Boolean(hasPr),
    staleTime: 15_000,
    refetchInterval: hasPr ? 60_000 : false,
  });
}

export function useAgentJob(jobId?: string) {
  return useQuery({
    queryKey: ["agent-job", jobId],
    queryFn: () => agentApi.getJob(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const job = query.state.data?.data;
      if (!job) return false;
      return job.status === "pending" || job.status === "running"
        ? 2000
        : false;
    },
  });
}

export function useApplyChangesToPr(featureRequestId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (proposedChanges: ProposedChange[]) =>
      agentApi.applyChangesToPr(featureRequestId, proposedChanges),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["agent-jobs", featureRequestId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["pr-status", featureRequestId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["pr-files", featureRequestId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["agent-chat", featureRequestId],
        }),
      ]);
    },
  });
}

export function useTriggerOrchestration(featureRequestId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => agentApi.triggerOrchestration(featureRequestId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["agent-jobs", featureRequestId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["pr-files", featureRequestId],
        }),
      ]);
    },
  });
}

export function useCodeIndexStatus(connectorId?: string) {
  return useQuery({
    queryKey: ["code-index-status", connectorId],
    queryFn: () => agentApi.getIndexStatus(connectorId as string),
    enabled: Boolean(connectorId),
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      return status === "indexing" || status === "pending" ? 3000 : false;
    },
  });
}

export function useTriggerIndex() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (connectorId: string) => agentApi.triggerIndex(connectorId),
    onSuccess: async (_data, connectorId) => {
      await queryClient.invalidateQueries({
        queryKey: ["code-index-status", connectorId],
      });
    },
  });
}
