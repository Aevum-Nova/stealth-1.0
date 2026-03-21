import agentApi from "@/api/agent-client";
import type { ApiResponse } from "@/types/api";
import type {
  AgentJob,
  ChatMessage,
  CodeIndexStatus,
  Conversation,
  ProposedChange,
} from "@/types/agent";

export function sendChatMessage(featureRequestId: string, message: string) {
  return agentApi
    .post(`feature-requests/${featureRequestId}/chat`, { json: { message } })
    .json<ApiResponse<ChatMessage>>();
}

export function streamChatMessage(
  featureRequestId: string,
  message: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
  onStatus?: (status: string) => void,
): () => void {
  const baseUrl =
    import.meta.env.VITE_AGENT_URL || "http://localhost:3002/api/v1";
  const url = `${baseUrl}/feature-requests/${featureRequestId}/chat/stream`;

  const controller = new AbortController();

  (async () => {
    try {
      const { getAccessToken } = await import("@/lib/auth");
      const token = getAccessToken();

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message }),
        signal: controller.signal,
        credentials: "include",
      });

      if (!response.ok || !response.body) {
        onError(`Stream request failed: ${response.status}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);
            if (event.type === "token") {
              onToken(event.content);
            } else if (event.type === "status") {
              onStatus?.(event.content);
            } else if (event.type === "done") {
              onDone();
              return;
            } else if (event.type === "error") {
              onError(event.content);
              return;
            }
          } catch {
            // skip malformed SSE data
          }
        }
      }

      onDone();
    } catch (err) {
      if (!controller.signal.aborted) {
        onError(err instanceof Error ? err.message : "Stream failed");
      }
    }
  })();

  return () => controller.abort();
}

export function getChatHistory(featureRequestId: string) {
  return agentApi
    .get(`feature-requests/${featureRequestId}/chat`)
    .json<ApiResponse<Conversation>>();
}

export function generateSummary(featureRequestId: string) {
  return agentApi
    .post(`feature-requests/${featureRequestId}/summary`)
    .json<ApiResponse<{ summary: string }>>();
}

export function triggerOrchestration(featureRequestId: string) {
  return agentApi
    .post(`feature-requests/${featureRequestId}/trigger`, { json: {} })
    .json<ApiResponse<AgentJob>>();
}

export interface ApplyChangesResult {
  commit_sha: string;
  pull_request_url: string;
}

export function applyChangesToPr(
  featureRequestId: string,
  proposedChanges: ProposedChange[],
) {
  return agentApi
    .post(`feature-requests/${featureRequestId}/apply-changes`, {
      json: { proposed_changes: proposedChanges },
    })
    .json<ApiResponse<ApplyChangesResult>>();
}

export function getJob(jobId: string) {
  return agentApi.get(`jobs/${jobId}`).json<ApiResponse<AgentJob>>();
}

export function listJobs(featureRequestId: string) {
  return agentApi
    .get(`feature-requests/${featureRequestId}/jobs`)
    .json<ApiResponse<AgentJob[]>>();
}

export function getPrStatus(featureRequestId: string) {
  return agentApi
    .get(`feature-requests/${featureRequestId}/pr-status`)
    .json<ApiResponse<{ exists: boolean; url: string | null; state: string }>>();
}

export function triggerIndex(connectorId: string) {
  return agentApi
    .post(`connectors/${connectorId}/index`)
    .json<ApiResponse<CodeIndexStatus>>();
}

export function getIndexStatus(connectorId: string) {
  return agentApi
    .get(`connectors/${connectorId}/index/status`)
    .json<ApiResponse<CodeIndexStatus>>();
}
