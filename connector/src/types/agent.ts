export interface SearchReplace {
  search: string;
  replace: string;
}

export interface ProposedChange {
  file_path: string;
  content: string;
  reason: string;
  search_replace?: SearchReplace[] | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  proposed_changes?: ProposedChange[] | null;
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
  proposed_files: { file_path: string; reason: string; content?: string; additions?: number; deletions?: number }[];
  commit_sha?: string | null;
  pull_request_url?: string | null;
  pull_request_state?: "open" | "closed" | "merged" | "unknown" | null;
  pull_request_merged?: boolean | null;
}

export type CodeIndexStatusType = "not_started" | "pending" | "indexing" | "ready" | "failed";

export interface CodeIndexStatus {
  connector_id: string;
  status: CodeIndexStatusType;
  total_files: number;
  indexed_files: number;
  commit_sha?: string | null;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}
