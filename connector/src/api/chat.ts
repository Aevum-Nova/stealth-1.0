export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls?: ChatToolCall[];
  created_at: string;
}

export interface ChatToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ChatConversation {
  id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface ChatQueryRequest {
  message: string;
  conversation_id?: string;
}

export type StreamEventType = "token" | "tool_call" | "tool_result" | "status" | "done";

export interface StreamEvent {
  type: StreamEventType;
  name?: string;
  content: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
}
