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
    <div className="flex h-full flex-col bg-white">
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white">
        <div className="mx-auto max-w-4xl px-6 py-8">
          {chatQuery.isLoading && (
            <div className="flex h-32 items-center justify-center">
              <LoadingSpinner label="Loading chat..." />
            </div>
          )}
          {messages.length === 0 && !chatQuery.isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-[15px] font-medium text-[var(--ink-soft)]">
                Ask about the codebase, suggest changes, or refine the PR.
              </p>
              <p className="mt-2 text-[13px] text-[var(--ink-muted)]">
                I can help you understand and improve this feature.
              </p>
            </div>
          )}
          <div className="space-y-0">
            {messages.map((msg, i) => (
              <div key={msg.id}>
                {i > 0 && msg.role === "assistant" && (
                  <div className="flex items-center py-3">
                    <div className="flex-1 border-t border-[#e5e5e5]" />
                    <span className="px-4 text-[11px] text-[var(--ink-muted)]">
                      {i} previous {i === 1 ? "message" : "messages"} &gt;
                    </span>
                    <div className="flex-1 border-t border-[#e5e5e5]" />
                  </div>
                )}
                <ChatMessage message={msg} />
              </div>
            ))}
            {sendMutation.isPending && (
              <div className={`flex items-center gap-2 text-[var(--ink-muted)] ${messages.length ? "mt-3" : ""}`}>
                <span className="text-[var(--ink-muted)]">&gt;</span>
                <span className="text-[13px]">Thinking</span>
              </div>
            )}
            {sendMutation.isError && (
              <div className={`rounded-lg border border-[#e5e5e5] bg-white px-4 py-3 text-[13px] text-[var(--ink)] ${messages.length ? "mt-3" : ""}`}>
                Failed to send.{" "}
                <button className="font-medium underline" onClick={() => sendMutation.reset()}>
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-[#eeeeee] bg-white px-6 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="chat-input-container flex items-end gap-3 rounded-full bg-[#f5f5f5] px-5 py-3 transition-colors focus-within:bg-[#eeeeee]">
            <textarea
              className="min-h-[22px] max-h-[140px] min-w-0 flex-1 resize-none border-none bg-transparent text-[14px] leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
              placeholder="Find leads, enrich data, paste or drop images..."
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
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
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
