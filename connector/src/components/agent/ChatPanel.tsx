import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

import ChatMessage from "@/components/agent/ChatMessage";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useChatHistory, useSendChatMessage } from "@/hooks/use-agent";

export default function ChatPanel({ featureRequestId }: { featureRequestId: string }) {
  const [input, setInput] = useState("");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatQuery = useChatHistory(featureRequestId);
  const sendMutation = useSendChatMessage(featureRequestId);

  const serverMessages = chatQuery.data?.data?.messages ?? [];
  const messages =
    pendingMessage && sendMutation.isPending
      ? [
          ...serverMessages,
          {
            id: "pending",
            role: "user" as const,
            content: pendingMessage,
            created_at: new Date().toISOString(),
            proposed_changes: null,
          },
        ]
      : serverMessages;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    if (!sendMutation.isPending) setPendingMessage(null);
  }, [sendMutation.isPending]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    setInput("");
    setPendingMessage(trimmed);
    sendMutation.mutate(trimmed);
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6">
          {chatQuery.isLoading && (
            <div className="flex h-24 items-center justify-center">
              <LoadingSpinner label="Loading chat..." />
            </div>
          )}
          {messages.length === 0 && !chatQuery.isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-[14px] text-[var(--ink-soft)]">
                Ask about the codebase, suggest changes, or refine the PR.
              </p>
              <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
                I can help you understand and improve this feature.
              </p>
            </div>
          )}
          <div className="space-y-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {sendMutation.isPending && (
              <div className="flex items-center gap-2 rounded-2xl bg-[var(--surface-subtle)] px-4 py-3">
                <span className="size-2 animate-pulse rounded-full bg-[var(--ink-muted)]" />
                <span className="text-[13px] text-[var(--ink-muted)]">Thinking...</span>
              </div>
            )}
            {sendMutation.isError && (
              <div className="rounded-2xl border border-rose-200/60 bg-rose-50/80 px-4 py-3 text-[13px] text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30">
                Failed to send.{" "}
                <button className="font-medium underline" onClick={() => sendMutation.reset()}>
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--line-soft)] bg-[var(--surface)] px-4 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="chat-input-container flex items-end gap-3 rounded-2xl bg-[var(--surface-subtle)] px-4 py-2.5 transition-colors focus-within:ring-1 focus-within:ring-[var(--line-muted)]">
            <textarea
              className="min-h-[24px] max-h-[140px] min-w-0 flex-1 resize-none border-none bg-transparent text-[14px] leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
              placeholder="Ask for follow-up changes..."
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={sendMutation.isPending}
            />
            <button
              className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--action-primary)] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
