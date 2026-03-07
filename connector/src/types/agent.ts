export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  feature_request_id: string;
  messages: ChatMessage[];
  created_at: string;
}

export type AgentJobStatus = "pending" | "running" | "completed" | "failed";

export interface AgentJob {
  id: string;
  feature_request_id: string;
  status: AgentJobStatus;
  result: OrchestrationResult | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrchestrationResult {
  feature_name: string;
  rationale: string;
  priority_score: number;
  spec_summary: string;
  acceptance_criteria: string[];
  tasks: string[];
  risk_notes: string[];
  proposed_files: { file_path: string; reason: string; additions?: number; deletions?: number }[];
  dry_run: boolean;
  commit_sha?: string | null;
  pull_request_url?: string | null;
}
