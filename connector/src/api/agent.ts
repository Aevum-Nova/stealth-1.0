import agentApi from "@/api/agent-client";
import type { ApiResponse } from "@/types/api";
import type { AgentJob, ChatMessage, Conversation } from "@/types/agent";

export function sendChatMessage(featureRequestId: string, message: string) {
  return agentApi
    .post(`feature-requests/${featureRequestId}/chat`, { json: { message } })
    .json<ApiResponse<ChatMessage>>();
}

export function getChatHistory(featureRequestId: string) {
  return agentApi
    .get(`feature-requests/${featureRequestId}/chat`)
    .json<ApiResponse<Conversation>>();
}

export function triggerOrchestration(featureRequestId: string, dryRun: boolean = true) {
  return agentApi
    .post(`feature-requests/${featureRequestId}/trigger`, { json: { dry_run: dryRun } })
    .json<ApiResponse<AgentJob>>();
}

export function getJob(jobId: string) {
  return agentApi.get(`jobs/${jobId}`).json<ApiResponse<AgentJob>>();
}

export function listJobs(featureRequestId: string) {
  return agentApi
    .get(`feature-requests/${featureRequestId}/jobs`)
    .json<ApiResponse<AgentJob[]>>();
}
