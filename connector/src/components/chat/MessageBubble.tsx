import { useMemo } from "react";

import type { ChatToolCallEntry } from "@/hooks/use-chat";
import { MessageContent } from "@/lib/chat-message-content";

/** One chip per tool name: multiple parallel uses of the same tool show as a single row. */
function groupToolCallsByName(
  toolCalls: ChatToolCallEntry[] | undefined,
): { name: string; status: "pending" | "done" }[] {
  if (!toolCalls?.length) return [];
  const m = new Map<string, { pending: number; done: number }>();
  for (const tc of toolCalls) {
    const cur = m.get(tc.name) || { pending: 0, done: 0 };
    if (tc.status === "done") cur.done += 1;
    else cur.pending += 1;
    m.set(tc.name, cur);
  }
  return Array.from(m.entries()).map(([name, c]) => ({
    name,
    status: c.pending > 0 ? ("pending" as const) : ("done" as const),
  }));
}

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ChatToolCallEntry[];
  isStreaming?: boolean;
  /** Claude-style thread: flat assistant rows, pill user bubbles */
  variant?: "bubble" | "claude";
}

const toolDisplayNames: Record<string, string> = {
  get_triggers: "Fetching triggers",
  get_trigger_detail: "Getting trigger details",
  get_feature_requests: "Fetching feature requests",
  get_feature_request_detail: "Loading feature request details",
  compare_feature_requests_code: "Comparing code across feature requests",
  get_signal_stats: "Analyzing signals",
  get_connectors: "Checking connectors",
  get_dashboard_stats: "Loading overview",
};

export function MessageBubble({
  role,
  content,
  toolCalls,
  isStreaming,
  variant = "bubble",
}: MessageBubbleProps) {
  const isUser = role === "user";
  const claude = variant === "claude";

  const groupedTools = useMemo(() => groupToolCallsByName(toolCalls), [toolCalls]);

  const toolRow = groupedTools.length > 0 && (
    <div className="mb-3 flex flex-wrap gap-2">
      {groupedTools.map((tc) => (
        <div
          key={tc.name}
          className={
            isUser
              ? claude
                ? "flex items-center gap-1.5 rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-[11px] text-[var(--ink-soft)]"
                : "flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-white/80"
              : "flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[11px] text-[var(--ink-soft)]"
          }
        >
          {tc.status === "pending" ? (
            <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent opacity-70" />
          ) : (
            <svg className="h-3 w-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span>{toolDisplayNames[tc.name] || tc.name}</span>
        </div>
      ))}
    </div>
  );

  if (claude) {
    if (isUser) {
      return (
        <div className="flex w-full justify-end py-2">
          <div className="max-w-[min(85%,28rem)] rounded-[1.35rem] bg-[var(--chat-claude-user-bg)] px-4 py-2.5 text-[14px] leading-relaxed text-[var(--ink)]">
            {toolRow}
            <p className="whitespace-pre-wrap">{content}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="w-full py-6">
        {toolRow}
        <div className="text-[14px] leading-relaxed text-[var(--ink)]">
          <MessageContent content={content} isStreaming={!!isStreaming} />
        </div>
      </div>
    );
  }

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-2xl rounded-br-md bg-[var(--message-user)] px-4 py-3 text-white"
            : "max-w-[80%] rounded-2xl rounded-bl-md bg-[var(--message-assistant)] px-4 py-3 text-[var(--ink)]"
        }
      >
        {toolRow}
        {isUser ? (
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{content}</p>
        ) : (
          <MessageContent content={content} isStreaming={!!isStreaming} />
        )}
      </div>
    </div>
  );
}
