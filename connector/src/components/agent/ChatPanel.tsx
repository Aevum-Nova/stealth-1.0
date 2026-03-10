import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";

import ChatMessage from "@/components/agent/ChatMessage";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useChatHistory, useSendChatMessage } from "@/hooks/use-agent";

export default function ChatPanel({ featureRequestId }: { featureRequestId: string }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatQuery = useChatHistory(featureRequestId);
  const sendMutation = useSendChatMessage(featureRequestId);

  const messages = chatQuery.data?.data?.messages ?? [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate(trimmed);
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {chatQuery.isLoading && (
          <div className="flex h-16 items-center justify-center">
            <LoadingSpinner label="Loading chat..." />
          </div>
        )}
        {messages.length === 0 && !chatQuery.isLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-[var(--surface-subtle)]">
              <Sparkles className="size-4 text-[var(--ink-muted)]" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-[var(--ink-soft)]">Ask about this feature</p>
              <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
                I can help you understand the codebase, suggest changes, and refine the PR.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {sendMutation.isPending && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--message-assistant)] px-3.5 py-2.5">
            <span className="size-1.5 animate-pulse rounded-full bg-[var(--ink-muted)]" />
            <span className="text-[12px] text-[var(--ink-soft)]">Thinking...</span>
          </div>
        )}
        {sendMutation.isError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-600">
            Failed to send.{" "}
            <button className="font-medium underline" onClick={() => sendMutation.reset()}>
              Retry
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--line-strong)] px-4 py-3">
        <div className="flex items-end gap-2 rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 transition-colors focus-within:border-[var(--focus-border)]">
          <textarea
            className="min-h-[20px] max-h-[120px] min-w-0 flex-1 resize-none border-none bg-transparent text-[13px] leading-snug text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
            placeholder="Ask about the code, suggest changes..."
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
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
            className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-[var(--action-primary)] text-white transition-colors hover:bg-[var(--action-primary-hover)] disabled:opacity-30"
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
          >
            <ArrowUp className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
